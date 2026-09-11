import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
import { staticPlugin } from "@elysia/static";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import {
    getAdminOrders,
    getOrder,
    getVisitorOrders,
    isOrderId,
} from "../api/orders/service";
import { HomePage } from "./HomePage";
import { CartPage } from "./CartPage";
import { OrdersPage } from "./OrdersPage";
import { OrderNotFoundPage, OrderPage } from "./OrderPage";
import { AdminOrdersPage } from "./AdminOrdersPage";
import { AdminOrderPage } from "./AdminOrderPage";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminPage } from "./AdminPage";
import { countCartUnits, getCartItems } from "../api/cart/service";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../auth/sessionCookie";
import {
    getOrCreateVisitorSession,
    visitorSessionCookieName,
} from "../auth/visitorSession";

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
    .get("/", async ({ cookie, request }) => {
        const visitor = await getOrCreateVisitorSession(
            cookie[visitorSessionCookieName],
            request,
        );
        return <HomePage cartCount={await countCartUnits(visitor.id)} />;
    })
    .get("/cart", async ({ cookie, query, request }) => {
        const visitor = await getOrCreateVisitorSession(
            cookie[visitorSessionCookieName],
            request,
        );
        const error =
            query.error === "checkout" && typeof query.message === "string"
                ? query.message
                : query.error
                  ? "The cart could not be changed."
                  : undefined;
        return (
            <CartPage items={await getCartItems(visitor.id)} error={error} />
        );
    })
    .get("/orders", async ({ cookie, request }) => {
        const visitor = await getOrCreateVisitorSession(
            cookie[visitorSessionCookieName],
            request,
        );
        return (
            <OrdersPage
                orders={await getVisitorOrders(visitor.id)}
                cartCount={await countCartUnits(visitor.id)}
            />
        );
    })
    .get("/orders/:id", async ({ cookie, params, request, set }) => {
        const visitor = await getOrCreateVisitorSession(
            cookie[visitorSessionCookieName],
            request,
        );
        const order = isOrderId(params.id) ? await getOrder(params.id) : null;
        if (!order) {
            set.status = 404;
            return <OrderNotFoundPage />;
        }
        return (
            <OrderPage
                order={order}
                cartCount={await countCartUnits(visitor.id)}
            />
        );
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
