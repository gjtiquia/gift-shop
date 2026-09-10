import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { isValidCsrfRequest } from "../../auth/csrf";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../../auth/sessionCookie";
import { db, inventoryTable } from "../../db";
import { parsePrice } from "../../utils";

const inventoryForm = t.Object({
    name: t.Optional(t.String()),
    price: t.Optional(t.String()),
    quantity: t.Optional(t.String()),
    adminNotes: t.Optional(t.String()),
});

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

async function rejectInvalidMutation(
    request: Request,
    authCookie: Parameters<typeof validateAuthSessionCookie>[0],
) {
    if (!isValidCsrfRequest(request)) {
        return new Response(null, { status: 403 });
    }

    const session = await validateAuthSessionCookie(authCookie, request);
    if (!session) {
        return new Response(null, {
            status: 303,
            headers: { location: "/admin/login" },
        });
    }

    return null;
}

export const inventory = new Elysia({ prefix: "inventory" })
    .post(
        "/",
        async ({ body, cookie, redirect, request }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const values = parseInventoryForm(body);
            if (!values) return redirect("/admin?error=invalid-input", 303);

            const now = new Date();
            await db.insert(inventoryTable).values({
                ...values,
                createdAt: now,
                lastModifiedAt: now,
            });

            return redirect("/admin", 303);
        },
        { body: inventoryForm },
    )
    .post(
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
                return redirect("/admin?error=invalid-input", 303);
            }

            await db
                .update(inventoryTable)
                .set({ ...values, lastModifiedAt: new Date() })
                .where(eq(inventoryTable.id, id));

            return redirect("/admin", 303);
        },
        { body: inventoryForm },
    )
    .post("/:id/delete", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidMutation(
            request,
            cookie[authSessionCookieName],
        );
        if (rejection) return rejection;

        const id = parseInventoryId(params.id);
        if (id === null) {
            return redirect("/admin?error=invalid-input", 303);
        }

        await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
        return redirect("/admin", 303);
    });
