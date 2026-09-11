import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
import { staticPlugin } from "@elysia/static";
import { asc, inArray } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import {
    getAdminOrders,
    getOrder,
    getOrders,
    isOrderId,
} from "../api/orders/service";
import { isValidCsrfRequest } from "../auth/csrf";
import { HomePage } from "./HomePage";
import { CartPage } from "./CartPage";
import { OrdersPage } from "./OrdersPage";
import { OrderNotFoundPage, OrderPage } from "./OrderPage";
import { AdminOrdersPage } from "./AdminOrdersPage";
import { AdminOrderPage } from "./AdminOrderPage";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminPage } from "./AdminPage";
import { CartContents } from "./components/CartContents";
import { OrderHistoryList } from "./components/OrderPresentation";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../auth/sessionCookie";

export const pages = new Elysia()
    .use(
        staticPlugin({
            assets: "src/pages/public",
            prefix: "/public",
            alwaysStatic: true,
            indexHTML: false,
        }),
    )
    .use(html())
    .get("/", () => <HomePage />)
    .get("/cart", () => <CartPage />)
    .post("/cart/contents", async ({ request }) => {
        if (!isValidCsrfRequest(request)) {
            return new Response(null, { status: 403 });
        }
        const items = parseCartPayload(
            String((await request.formData()).get("cart") ?? ""),
        );
        const inventoryIds = items.map((item) => item.inventoryId);
        const inventory =
            inventoryIds.length === 0
                ? []
                : await db
                      .select({
                          id: inventoryTable.id,
                          name: inventoryTable.name,
                          priceCentsX10: inventoryTable.priceCentsX10,
                          quantity: inventoryTable.quantity,
                          imageId: inventoryTable.imageId,
                      })
                      .from(inventoryTable)
                      .where(inArray(inventoryTable.id, inventoryIds));
        const inventoryById = new Map(inventory.map((item) => [item.id, item]));
        return (
            <CartContents
                revision={cartPayloadRevision(items)}
                items={items.map((item) => ({
                    ...item,
                    inventory: inventoryById.get(item.inventoryId) ?? null,
                }))}
            />
        );
    })
    .get("/orders", () => <OrdersPage />)
    .post("/orders/history", async ({ request }) => {
        if (!isValidCsrfRequest(request)) {
            return new Response(null, { status: 403 });
        }
        const ids = parseOrderHistoryPayload(
            String((await request.formData()).get("ids") ?? ""),
        );
        return <OrderHistoryList orders={await getOrders(ids)} />;
    })
    .get("/orders/:id", async ({ params, set }) => {
        const order = isOrderId(params.id) ? await getOrder(params.id) : null;
        if (!order) {
            set.status = 404;
            return <OrderNotFoundPage />;
        }
        return <OrderPage order={order} />;
    })
    .get("/admin/login", async ({ cookie, query, redirect, request }) => {
        const session = await validateAuthSessionCookie(
            cookie[authSessionCookieName],
            request,
        );
        if (session) return redirect("/admin");

        const error = query.error === "1" ? "Incorrect password." : undefined;
        return <AdminLoginPage error={error} />;
    })
    .get("/admin", async ({ cookie, query, redirect, request }) => {
        const session = await validateAuthSessionCookie(
            cookie[authSessionCookieName],
            request,
        );
        if (!session) return redirect("/admin/login");

        const error =
            query.error === "invalid-input"
                ? "Invalid inventory values."
                : undefined;
        return <AdminPage error={error} />;
    })
    .get("/admin/orders", async ({ cookie, redirect, request }) => {
        const session = await validateAuthSessionCookie(
            cookie[authSessionCookieName],
            request,
        );
        if (!session) return redirect("/admin/login");
        return <AdminOrdersPage orders={await getAdminOrders()} />;
    })
    .get(
        "/admin/orders/:id",
        async ({ cookie, params, query, redirect, request, set }) => {
            const session = await validateAuthSessionCookie(
                cookie[authSessionCookieName],
                request,
            );
            if (!session) return redirect("/admin/login");
            const order = isOrderId(params.id)
                ? await getOrder(params.id)
                : null;
            if (!order) {
                set.status = 404;
                return <OrderNotFoundPage />;
            }
            const inventory = await db
                .select()
                .from(inventoryTable)
                .orderBy(asc(inventoryTable.id));
            let error: string | undefined;
            if (query.error === "stock") {
                error =
                    `Inventory is not enough. ${query.message ?? ""}`.trim();
            } else if (query.error) {
                error = "The order could not be changed in its current state.";
            }
            return (
                <AdminOrderPage
                    order={order}
                    inventory={inventory}
                    error={error}
                />
            );
        },
    );

export function parseCartPayload(value: string) {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return [];
        }
        return Object.entries(parsed)
            .filter(
                ([id, quantity]) =>
                    /^\d+$/.test(id) &&
                    Number(id) > 0 &&
                    Number.isSafeInteger(quantity) &&
                    Number(quantity) > 0,
            )
            .slice(0, 100)
            .map(([id, quantity]) => ({
                inventoryId: Number(id),
                quantity: Number(quantity),
            }));
    } catch {
        return [];
    }
}

export function parseOrderHistoryPayload(value: string) {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return Array.from(
            new Set(
                parsed.filter(
                    (id): id is string =>
                        typeof id === "string" && isOrderId(id),
                ),
            ),
        ).slice(0, 100);
    } catch {
        return [];
    }
}

function cartPayloadRevision(
    items: Array<{ inventoryId: number; quantity: number }>,
) {
    return JSON.stringify(
        items
            .map((item) => [String(item.inventoryId), item.quantity] as const)
            .sort(([first], [second]) => Number(first) - Number(second)),
    );
}
