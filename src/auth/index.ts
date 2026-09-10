import { Elysia, t } from "elysia";
import { isValidCsrfRequest } from "./csrf";
import { createAuthSession } from "./lucia";
import { authSessionCookieName, setAuthSessionCookie } from "./sessionCookie";

export const auth = new Elysia({ prefix: "auth" }).post(
    "/login",
    async ({ body, cookie, redirect, request }) => {
        if (!isValidCsrfRequest(request)) {
            return new Response(null, { status: 403 });
        }

        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword || body.password !== adminPassword) {
            return redirect("/admin/login?error=1", 303);
        }

        const { authSessionToken } = await createAuthSession("admin");
        setAuthSessionCookie(
            cookie[authSessionCookieName],
            authSessionToken,
            request,
        );

        return redirect("/admin", 303);
    },
    {
        body: t.Object({
            password: t.Optional(t.String()),
        }),
    },
);
