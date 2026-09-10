import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { isValidCsrfRequest } from "../../auth/csrf";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../../auth/sessionCookie";
import { db, imagesTable, inventoryTable } from "../../db";
import { InventoryRow } from "../../pages/components/InventoryRow";
import { parsePrice } from "../../utils";
import {
    ImageValidationError,
    removeStoredImage,
    storeImage,
} from "../images/storage";

type InventoryFormBody = {
    name?: string;
    price?: string;
    quantity?: string;
    adminNotes?: string;
    image?: File;
    removeImage?: string;
};

export const inventory = new Elysia({ prefix: "inventory" })
    .post(
        "/",
        async ({ body, cookie, redirect, request, set }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const values = parseInventoryForm(body);
            if (!values) return invalidInventoryResponse(request);

            const imageFile = submittedImage(body.image);
            let storedImage: Awaited<ReturnType<typeof storeImage>> | null =
                null;
            try {
                if (imageFile) storedImage = await storeImage(imageFile);
            } catch (error) {
                if (error instanceof ImageValidationError) {
                    return invalidInventoryResponse(request, error.message);
                }
                throw error;
            }

            const now = new Date();
            let item: typeof inventoryTable.$inferSelect;
            try {
                item = db.transaction((transaction) => {
                    let imageId: number | null = null;
                    if (storedImage) {
                        const [image] = transaction
                            .insert(imagesTable)
                            .values({
                                filename: storedImage.filename,
                                createdAt: now,
                                lastModifiedAt: now,
                            })
                            .returning({ id: imagesTable.id })
                            .all();
                        imageId = image.id;
                    }

                    const [createdItem] = transaction
                        .insert(inventoryTable)
                        .values({
                            ...values,
                            imageId,
                            createdAt: now,
                            lastModifiedAt: now,
                        })
                        .returning()
                        .all();
                    return createdItem;
                });
            } catch (error) {
                if (storedImage) {
                    await retainImageForCleanup(storedImage.filename);
                }
                throw error;
            }

            await cleanupUnreferencedImages();
            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            set.status = 201;
            return InventoryRow({ item });
        },
        { body: inventoryForm() },
    )
    .put(
        "/:id",
        async ({ body, cookie, params, redirect, request }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const result = await updateInventory(body, params.id, request);
            if (result instanceof Response) return result;
            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            return InventoryRow({ item: result });
        },
        { body: inventoryForm() },
    )
    .post(
        "/:id",
        async ({ body, cookie, params, redirect, request }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const result = await updateInventory(body, params.id, request);
            if (result instanceof Response) return result;
            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            return InventoryRow({ item: result });
        },
        { body: inventoryForm() },
    )
    .delete("/:id", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidMutation(
            request,
            cookie[authSessionCookieName],
        );
        if (rejection) return rejection;

        const id = parseInventoryId(params.id);
        if (id === null) return invalidInventoryResponse(request);

        const [deleted] = await db
            .delete(inventoryTable)
            .where(eq(inventoryTable.id, id))
            .returning({ id: inventoryTable.id });

        if (!deleted) return inventoryNotFoundResponse();
        await cleanupUnreferencedImages();
        if (!isHtmxRequest(request)) return redirect("/admin", 303);

        return new Response(null, { status: 200 });
    });

async function updateInventory(
    body: InventoryFormBody,
    idValue: string,
    request: Request,
): Promise<typeof inventoryTable.$inferSelect | Response> {
    const id = parseInventoryId(idValue);
    const values = parseInventoryForm(body);
    if (id === null || !values) return invalidInventoryResponse(request);

    const imageFile = submittedImage(body.image);
    let storedImage: Awaited<ReturnType<typeof storeImage>> | null = null;
    try {
        if (imageFile) storedImage = await storeImage(imageFile);
    } catch (error) {
        if (error instanceof ImageValidationError) {
            return invalidInventoryResponse(request, error.message);
        }
        throw error;
    }

    let item: typeof inventoryTable.$inferSelect | null;
    try {
        item = db.transaction((transaction) => {
            const [existingItem] = transaction
                .select({ imageId: inventoryTable.imageId })
                .from(inventoryTable)
                .where(eq(inventoryTable.id, id))
                .limit(1)
                .all();
            if (!existingItem) return null;

            let nextImageId = existingItem.imageId;
            if (storedImage) {
                const now = new Date();
                const [image] = transaction
                    .insert(imagesTable)
                    .values({
                        filename: storedImage.filename,
                        createdAt: now,
                        lastModifiedAt: now,
                    })
                    .returning({ id: imagesTable.id })
                    .all();
                nextImageId = image.id;
            } else if (body.removeImage === "1") {
                nextImageId = null;
            }

            const [updatedItem] = transaction
                .update(inventoryTable)
                .set({
                    ...values,
                    imageId: nextImageId,
                    lastModifiedAt: new Date(),
                })
                .where(eq(inventoryTable.id, id))
                .returning()
                .all();
            return updatedItem;
        });
    } catch (error) {
        if (storedImage) await retainImageForCleanup(storedImage.filename);
        throw error;
    }

    if (!item) {
        if (storedImage) await retainImageForCleanup(storedImage.filename);
        return inventoryNotFoundResponse();
    }

    await cleanupUnreferencedImages();
    return item;
}

// Unreferenced image rows are durable retry records when a file cannot be removed.
async function cleanupUnreferencedImages() {
    try {
        const images = await db
            .select({ id: imagesTable.id, filename: imagesTable.filename })
            .from(imagesTable);

        for (const image of images) {
            const [reference] = await db
                .select({ id: inventoryTable.id })
                .from(inventoryTable)
                .where(eq(inventoryTable.imageId, image.id))
                .limit(1);
            if (reference) continue;
            if (!(await removeStoredImage(image.filename))) continue;

            await db.delete(imagesTable).where(eq(imagesTable.id, image.id));
        }
    } catch (error) {
        console.error(
            "Could not reconcile unreferenced inventory images.",
            error,
        );
    }
}

async function retainImageForCleanup(filename: string) {
    const now = new Date();
    try {
        await db.insert(imagesTable).values({
            filename,
            createdAt: now,
            lastModifiedAt: now,
        });
        await cleanupUnreferencedImages();
    } catch (error) {
        console.error(
            `Could not retain cleanup metadata for ${filename}.`,
            error,
        );
        await removeStoredImage(filename);
    }
}

async function rejectInvalidMutation(
    request: Request,
    authCookie: Parameters<typeof validateAuthSessionCookie>[0],
) {
    if (!isValidCsrfRequest(request)) {
        return new Response(null, { status: 403 });
    }

    const session = await validateAuthSessionCookie(authCookie, request);
    if (!session) {
        if (isHtmxRequest(request)) {
            return new Response(null, {
                status: 401,
                headers: { "HX-Redirect": "/admin/login" },
            });
        }

        return new Response(null, {
            status: 303,
            headers: { location: "/admin/login" },
        });
    }

    return null;
}

function invalidInventoryResponse(
    request: Request,
    message = "Invalid inventory values.",
) {
    if (!isHtmxRequest(request)) {
        return new Response(null, {
            status: 303,
            headers: { location: "/admin?error=invalid-input" },
        });
    }

    return new Response(message, {
        status: 422,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "HX-Retarget": "#inventory-error",
            "HX-Reswap": "innerHTML",
        },
    });
}

function inventoryNotFoundResponse() {
    return new Response("Inventory item not found.", {
        status: 404,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "HX-Retarget": "#inventory-error",
            "HX-Reswap": "innerHTML",
        },
    });
}

function isHtmxRequest(request: Request) {
    return request.headers.get("HX-Request") === "true";
}

function parseInventoryForm(body: InventoryFormBody) {
    const name = body.name?.trim();
    const priceCentsX10 = body.price ? parsePrice(body.price) : null;
    const quantity = body.quantity?.trim();
    const parsedQuantity =
        quantity && /^\d+$/.test(quantity) ? Number(quantity) : NaN;

    if (
        !name ||
        priceCentsX10 === null ||
        !Number.isSafeInteger(parsedQuantity)
    ) {
        return null;
    }

    return {
        name,
        priceCentsX10,
        quantity: parsedQuantity,
        adminNotes: body.adminNotes?.trim() || null,
    };
}

function submittedImage(image: File | undefined) {
    if (!image) return null;
    if (image.size === 0 && image.name === "") return null;
    return image;
}

function parseInventoryId(id: string) {
    if (!/^\d+$/.test(id)) return null;
    const parsedId = Number(id);
    return Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

function inventoryForm() {
    return t.Object({
        name: t.Optional(t.String()),
        price: t.Optional(t.String()),
        quantity: t.Optional(t.String()),
        adminNotes: t.Optional(t.String()),
        image: t.Optional(t.File()),
        removeImage: t.Optional(t.String()),
    });
}
