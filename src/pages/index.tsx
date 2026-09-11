import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
import { staticPlugin } from "@elysia/static";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { getAdminOrders, getOrder, isOrderId } from "../api/orders/service";
import { HomePage } from "./HomePage";
import { CartPage } from "./CartPage";
import { OrdersPage } from "./OrdersPage";
import { OrderNotFoundPage, OrderPage } from "./OrderPage";
import { AdminOrdersPage } from "./AdminOrdersPage";
import { AdminOrderPage } from "./AdminOrderPage";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminPage } from "./AdminPage";
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
    .get("/orders", () => <OrdersPage />)
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
