import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
import { staticPlugin } from "@elysia/static";
import { HomePage } from "./HomePage";
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
            directive: "no-cache",
            maxAge: 0,
        }),
    )
    .use(html())
    .get("/", () => <HomePage />)
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
    });
