import { Elysia } from "elysia";
import { HomePage } from "./HomePage";
import { html, Html } from "@elysia/html";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminPage } from "./AdminPage";
import {
    authSessionCookieName,
    validateAuthSessionCookie,
} from "../auth/sessionCookie";

export const pages = new Elysia()
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
