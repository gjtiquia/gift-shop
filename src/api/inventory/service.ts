import { eq, inArray } from "drizzle-orm";
import { db, imagesTable, inventoryTable } from "../../db";
import { parsePrice } from "../../utils";
import {
    ImageValidationError,
    imageDataDirectory,
    listStoredImageFilenames,
    removeStoredImage,
    removeStoredImageFromDirectory,
    storeImage,
} from "../images/storage";
import type { InventoryForm } from "./model";

type InventoryItem = typeof inventoryTable.$inferSelect;

export type InventoryMutationResult =
    | { status: "success"; item: InventoryItem }
    | { status: "invalid"; message: string }
    | { status: "not-found" };

export type InventoryDeleteResult =
    { status: "success" } | { status: "invalid" } | { status: "not-found" };

export interface BulkInventoryItem {
    id: string;
    form: InventoryForm;
}

export type BulkInventoryMutationResult =
    | { status: "success" }
    | { status: "invalid"; message: string }
    | { status: "not-found" };

export async function createInventory(
    form: InventoryForm,
): Promise<Exclude<InventoryMutationResult, { status: "not-found" }>> {
    const values = parseInventoryForm(form);
    if (!values) return invalidResult();

    const storedImage = await storeSubmittedImage(form.image);
    if ("error" in storedImage) return invalidResult(storedImage.error);

    const now = new Date();
    let item: InventoryItem;
    try {
        item = db.transaction((transaction) => {
            let imageId: number | null = null;
            if (storedImage.image) {
                const [image] = transaction
                    .insert(imagesTable)
                    .values({
                        filename: storedImage.image.filename,
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
        if (storedImage.image) {
            await retainImageForCleanup(storedImage.image.filename);
        }
        throw error;
    }

    await cleanupUnreferencedImages();
    return { status: "success", item };
}

export async function updateInventory(
    idValue: string,
    form: InventoryForm,
): Promise<InventoryMutationResult> {
    const id = parseInventoryId(idValue);
    const values = parseInventoryForm(form);
    if (id === null || !values) return invalidResult();

    const storedImage = await storeSubmittedImage(form.image);
    if ("error" in storedImage) return invalidResult(storedImage.error);

    let item: InventoryItem | null;
    try {
        item = db.transaction((transaction) => {
            const [existingItem] = transaction
                .select({ imageId: inventoryTable.imageId })
                .from(inventoryTable)
                .where(eq(inventoryTable.id, id))
                .limit(1)
                .all();
            if (!existingItem) return null;

            let imageId = existingItem.imageId;
            if (storedImage.image) {
                const now = new Date();
                const [image] = transaction
                    .insert(imagesTable)
                    .values({
                        filename: storedImage.image.filename,
                        createdAt: now,
                        lastModifiedAt: now,
                    })
                    .returning({ id: imagesTable.id })
                    .all();
                imageId = image.id;
            }

            const [updatedItem] = transaction
                .update(inventoryTable)
                .set({
                    ...values,
                    imageId,
                    lastModifiedAt: new Date(),
                })
                .where(eq(inventoryTable.id, id))
                .returning()
                .all();
            return updatedItem;
        });
    } catch (error) {
        if (storedImage.image) {
            await retainImageForCleanup(storedImage.image.filename);
        }
        throw error;
    }

    if (!item) {
        if (storedImage.image) {
            await retainImageForCleanup(storedImage.image.filename);
        }
        return { status: "not-found" };
    }

    await cleanupUnreferencedImages();
    return { status: "success", item };
}

export async function updateInventoryBatch(
    submittedItems: BulkInventoryItem[],
): Promise<BulkInventoryMutationResult> {
    const parsedItems: Array<{
        id: number;
        values: NonNullable<ReturnType<typeof parseInventoryForm>>;
        image?: File;
    }> = [];
    const ids = new Set<number>();

    for (const submitted of submittedItems) {
        const id = parseInventoryId(submitted.id);
        const values = parseInventoryForm(submitted.form);
        if (id === null || !values || ids.has(id)) return invalidResult();
        ids.add(id);
        parsedItems.push({ id, values, image: submitted.form.image });
    }

    if (parsedItems.length === 0) return { status: "success" };

    const existingItems = await db
        .select({ id: inventoryTable.id })
        .from(inventoryTable)
        .where(
            inArray(
                inventoryTable.id,
                parsedItems.map((item) => item.id),
            ),
        );
    if (existingItems.length !== parsedItems.length) {
        return { status: "not-found" };
    }

    const storedImages = new Map<
        number,
        Awaited<ReturnType<typeof storeImage>>
    >();
    try {
        for (const item of parsedItems) {
            const storedImage = await storeSubmittedImage(item.image);
            if ("error" in storedImage) {
                await discardStagedImages(storedImages.values());
                return invalidResult(storedImage.error);
            }
            if (storedImage.image) storedImages.set(item.id, storedImage.image);
        }
    } catch (error) {
        await retainStagedImagesForCleanup(storedImages.values());
        throw error;
    }

    const now = new Date();
    try {
        db.transaction((transaction) => {
            const transactionItems = transaction
                .select({ id: inventoryTable.id })
                .from(inventoryTable)
                .where(
                    inArray(
                        inventoryTable.id,
                        parsedItems.map((item) => item.id),
                    ),
                )
                .all();
            if (transactionItems.length !== parsedItems.length) {
                throw new InventoryBatchConflictError();
            }

            for (const item of parsedItems) {
                const storedImage = storedImages.get(item.id);
                let imageId: number | undefined;
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

                transaction
                    .update(inventoryTable)
                    .set({
                        ...item.values,
                        ...(imageId === undefined ? {} : { imageId }),
                        lastModifiedAt: now,
                    })
                    .where(eq(inventoryTable.id, item.id))
                    .run();
            }
        });
    } catch (error) {
        await retainStagedImagesForCleanup(storedImages.values());
        if (error instanceof InventoryBatchConflictError) {
            return { status: "not-found" };
        }
        throw error;
    }

    await cleanupUnreferencedImages();
    return { status: "success" };
}

export async function deleteInventory(
    idValue: string,
): Promise<InventoryDeleteResult> {
    const id = parseInventoryId(idValue);
    if (id === null) return { status: "invalid" };

    const [deleted] = await db
        .delete(inventoryTable)
        .where(eq(inventoryTable.id, id))
        .returning({ id: inventoryTable.id });
    if (!deleted) return { status: "not-found" };

    await cleanupUnreferencedImages();
    return { status: "success" };
}

function parseInventoryForm(form: InventoryForm) {
    const name = form.name?.trim();
    const priceCentsX10 = form.price ? parsePrice(form.price) : null;
    const quantity = form.quantity?.trim();
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
        hidden: form.hidden === "true",
        adminNotes: form.adminNotes?.trim() || null,
    };
}

async function storeSubmittedImage(image: File | undefined) {
    if (!image || image.size === 0) {
        return { image: null };
    }

    try {
        return { image: await storeImage(image) };
    } catch (error) {
        if (error instanceof ImageValidationError) {
            return { error: error.message };
        }
        throw error;
    }
}

function parseInventoryId(id: string) {
    if (!/^\d+$/.test(id)) return null;
    const parsedId = Number(id);
    return Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

function invalidResult(message = "Invalid inventory values.") {
    return { status: "invalid" as const, message };
}

class InventoryBatchConflictError extends Error {}

export async function reconcileInventoryImageStorage(
    directory = imageDataDirectory,
) {
    const trackedFilenames = new Set(
        (
            await db
                .select({ filename: imagesTable.filename })
                .from(imagesTable)
        ).map((image) => image.filename),
    );

    for (const filename of await listStoredImageFilenames(directory)) {
        if (trackedFilenames.has(filename)) continue;
        if (!(await removeStoredImageFromDirectory(filename, directory))) {
            throw new Error(`Could not remove orphaned image ${filename}.`);
        }
    }

    await cleanupUnreferencedImages(directory);
}

async function discardStagedImages(images: Iterable<{ filename: string }>) {
    for (const image of images) {
        if (!(await removeStoredImage(image.filename))) {
            await retainImageForCleanup(image.filename);
        }
    }
}

async function retainStagedImagesForCleanup(
    images: Iterable<{ filename: string }>,
) {
    for (const image of images) {
        await retainImageForCleanup(image.filename);
    }
}

// Unreferenced image rows are durable retry records when a file cannot be removed.
async function cleanupUnreferencedImages(directory = imageDataDirectory) {
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
            if (
                !(await removeStoredImageFromDirectory(
                    image.filename,
                    directory,
                ))
            )
                continue;

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
