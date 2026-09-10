import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { isValidCsrfRequest } from "../../auth/csrf";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../../auth/sessionCookie";
import { db, inventoryTable } from "../../db";
import { InventoryRow } from "../../pages/components/InventoryRow";
import { parsePrice } from "../../utils";

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

            const now = new Date();
            const [item] = await db
                .insert(inventoryTable)
                .values({
                    ...values,
                    createdAt: now,
                    lastModifiedAt: now,
                })
                .returning();

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

            const id = parseInventoryId(params.id);
            const values = parseInventoryForm(body);
            if (id === null || !values) {
                return invalidInventoryResponse(request);
            }

            const [item] = await db
                .update(inventoryTable)
                .set({ ...values, lastModifiedAt: new Date() })
                .where(eq(inventoryTable.id, id))
                .returning();

            if (!item) return inventoryNotFoundResponse();
            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            return InventoryRow({ item });
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
        if (!isHtmxRequest(request)) return redirect("/admin", 303);

        return new Response(null, { status: 200 });
    });

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

function invalidInventoryResponse(request: Request) {
    if (!isHtmxRequest(request)) {
        return new Response(null, {
            status: 303,
            headers: { location: "/admin?error=invalid-input" },
        });
    }

    return new Response("Invalid inventory values.", {
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

function parseInventoryForm(body: {
    name?: string;
    price?: string;
    quantity?: string;
    adminNotes?: string;
}) {
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
    });
}
