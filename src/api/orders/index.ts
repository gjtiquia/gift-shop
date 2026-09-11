import { Elysia, t } from "elysia";
import { isValidCsrfRequest } from "../../auth/csrf";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../../auth/sessionCookie";
import {
    checkoutCart,
    editOrder,
    fulfillOrder,
    getOrder,
    getVisitorOrders,
    isOrderId,
    rejectOrder,
    restoreOrder,
    type OrderView,
} from "./service";
import {
    getOrCreateVisitorSession,
    visitorSessionCookieName,
} from "../../visitor/session";

export const orders = new Elysia({ prefix: "orders" })
    .get("/", async ({ cookie, request }) => {
        const visitor = await getOrCreateVisitorSession(
            cookie[visitorSessionCookieName],
            request,
        );
        return (await getVisitorOrders(visitor.id)).map(publicOrder);
    })
    .post(
        "/",
        async ({ body, cookie, redirect, request }) => {
            if (!isValidCsrfRequest(request)) {
                return new Response(null, { status: 403 });
            }
            const visitor = await getOrCreateVisitorSession(
                cookie[visitorSessionCookieName],
                request,
            );
            const result = await checkoutCart(visitor.id, body);
            if (result.status === "invalid") {
                return redirect(
                    `/cart?error=checkout&message=${encodeURIComponent(result.message)}`,
                    303,
                );
            }
            return redirect(`/orders/${result.order.id}`, 303);
        },
        {
            body: t.Object({
                customerName: t.String(),
                submissionId: t.String(),
            }),
        },
    )
    .get("/:id", async ({ params, set }) => {
        if (!isOrderId(params.id)) {
            set.status = 404;
            return { error: "Order not found." };
        }
        const order = await getOrder(params.id);
        if (!order) {
            set.status = 404;
            return { error: "Order not found." };
        }
        return { order: publicOrder(order) };
    })
    .post("/:id/edit", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidAdminMutation(request, cookie);
        if (rejection) return rejection;

        const form = await request.formData();
        const inventoryIds = form.getAll("inventoryId");
        const quantities = form.getAll("quantity");
        const itemAdminNotes = form.getAll("itemAdminNotes");
        const removed = new Set(form.getAll("remove").map(String));
        const items: Array<{
            inventoryId: number;
            quantity: number;
            adminNotes?: string;
        }> = [];
        for (let index = 0; index < inventoryIds.length; index++) {
            const inventoryIdValue = String(inventoryIds[index] ?? "").trim();
            const quantityValue = String(quantities[index] ?? "").trim();
            if (!inventoryIdValue && !quantityValue) continue;
            if (removed.has(String(index))) continue;
            items.push({
                inventoryId: Number(inventoryIdValue),
                quantity: Number(quantityValue),
                adminNotes: String(itemAdminNotes[index] ?? ""),
            });
        }
        const result = await editOrder(params.id, {
            customerName: String(form.get("customerName") ?? ""),
            adminNotes: String(form.get("adminNotes") ?? ""),
            items,
        });
        if (result.status !== "success") {
            const error =
                result.status === "not-found" ? "not-found" : "invalid-order";
            return redirect(`/admin/orders/${params.id}?error=${error}`, 303);
        }
        return redirect(`/admin/orders/${params.id}`, 303);
    })
    .post("/:id/fulfill", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidAdminMutation(request, cookie);
        if (rejection) return rejection;

        const result = await fulfillOrder(params.id);
        if (result.status === "success") {
            return redirect(`/admin/orders/${params.id}`, 303);
        }
        if (result.status === "insufficient-stock") {
            const message = result.shortages
                .map(
                    (item) =>
                        `${item.name}: needs ${item.requested}, has ${item.available}`,
                )
                .join("; ");
            return redirect(
                `/admin/orders/${params.id}?error=stock&message=${encodeURIComponent(message)}`,
                303,
            );
        }
        return redirect(
            `/admin/orders/${params.id}?error=${result.status}`,
            303,
        );
    })
    .post("/:id/reject", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidAdminMutation(request, cookie);
        if (rejection) return rejection;
        const result = await rejectOrder(params.id);
        return redirect(
            `/admin/orders/${params.id}${result.status === "success" ? "" : `?error=${result.status}`}`,
            303,
        );
    })
    .post("/:id/restore", async ({ cookie, params, redirect, request }) => {
        const rejection = await rejectInvalidAdminMutation(request, cookie);
        if (rejection) return rejection;
        const result = await restoreOrder(params.id);
        return redirect(
            `/admin/orders/${params.id}${result.status === "success" ? "" : `?error=${result.status}`}`,
            303,
        );
    });

export function publicOrder(order: OrderView) {
    return {
        id: order.id,
        customerName: order.customerName,
        status: order.status,
        createdAt: order.createdAt,
        lastModifiedAt: order.lastModifiedAt,
        fulfilledAt: order.fulfilledAt,
        rejectedAt: order.rejectedAt,
        items: order.items.map((item) => ({
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            inventory: item.inventory,
        })),
    };
}

async function rejectInvalidAdminMutation(
    request: Request,
    cookies: Record<string, unknown>,
) {
    if (!isValidCsrfRequest(request)) {
        return new Response(null, { status: 403 });
    }
    const session = await validateAuthSessionCookie(
        cookies[authSessionCookieName] as Parameters<
            typeof validateAuthSessionCookie
        >[0],
        request,
    );
    if (session) return null;
    return new Response(null, {
        status: 303,
        headers: { location: "/admin/login" },
    });
}
