import { Elysia } from "elysia";
import { isValidCsrfRequest } from "../../auth/csrf";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../../auth/sessionCookie";
import { InventoryRow } from "../../pages/components/InventoryRow";
import { inventoryFormSchema, type InventoryForm } from "./model";
import { createInventory, deleteInventory, updateInventory } from "./service";

export const inventory = new Elysia({ prefix: "inventory" })
    .post(
        "/",
        async ({ body, cookie, redirect, request, set }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const result = await createInventory(body);
            if (result.status === "invalid") {
                return invalidInventoryResponse(request, result.message);
            }

            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            set.status = 201;
            return InventoryRow({ item: result.item });
        },
        { body: inventoryFormSchema },
    )
    .put(
        "/:id",
        async ({ body, cookie, params, redirect, request }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const result = await inventoryUpdateResult(
                body,
                params.id,
                request,
            );
            if (result instanceof Response) return result;
            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            return InventoryRow({ item: result });
        },
        { body: inventoryFormSchema },
    )
    .post(
        "/:id",
        async ({ body, cookie, params, redirect, request }) => {
            const rejection = await rejectInvalidMutation(
                request,
                cookie[authSessionCookieName],
            );
            if (rejection) return rejection;

            const result = await inventoryUpdateResult(
                body,
                params.id,
                request,
            );
            if (result instanceof Response) return result;
            if (!isHtmxRequest(request)) return redirect("/admin", 303);

            return InventoryRow({ item: result });
        },
        { body: inventoryFormSchema },
    )
    .delete("/:id", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidMutation(
            request,
            cookie[authSessionCookieName],
        );
        if (rejection) return rejection;

        const result = await deleteInventory(params.id);
        if (result.status === "invalid") {
            return invalidInventoryResponse(request);
        }
        if (result.status === "not-found") return inventoryNotFoundResponse();
        if (!isHtmxRequest(request)) return redirect("/admin", 303);

        return new Response(null, { status: 200 });
    });

async function inventoryUpdateResult(
    body: InventoryForm,
    id: string,
    request: Request,
) {
    const result = await updateInventory(id, body);
    if (result.status === "invalid") {
        return invalidInventoryResponse(request, result.message);
    }
    if (result.status === "not-found") return inventoryNotFoundResponse();
    return result.item;
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
