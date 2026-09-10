import { Elysia } from "elysia";
import { HomePage } from "./HomePage";
import { html, Html } from "@elysia/html";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminPage } from "./AdminPage";
import {
    authSessionCookieName,
    isSecureRequest,
    validateAuthSessionCookie,
} from "../auth/sessionCookie";

export const pages = new Elysia()
    .use(html())
    .get("/", () => <HomePage />)
    .get("/admin/login", async ({ cookie, query, redirect, request }) => {
        const secure = isSecureRequest(request);
        const session = await validateAuthSessionCookie(
            cookie[authSessionCookieName],
            secure,
        );
        if (session) return redirect("/admin");

        const error = query.error === "1" ? "Incorrect password." : undefined;
        return <AdminLoginPage error={error} />;
    })
    .get("/admin", async ({ cookie, redirect, request }) => {
        const secure = isSecureRequest(request);
        const session = await validateAuthSessionCookie(
            cookie[authSessionCookieName],
            secure,
        );
        if (!session) return redirect("/admin/login");

        return <AdminPage />;
    });
