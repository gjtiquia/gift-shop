import { Elysia, t } from "elysia";
import { createAuthSession } from "./lucia";
import {
    authSessionCookieName,
    isSecureRequest,
    setAuthSessionCookie,
} from "./sessionCookie";

export const auth = new Elysia({ prefix: "auth" }).post(
    "/login",
    async ({ body, cookie, redirect, request }) => {
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword || body.password !== adminPassword) {
            return redirect("/admin/login?error=1", 303);
        }

        const { authSessionToken } = await createAuthSession("admin");
        const secure = isSecureRequest(request);
        setAuthSessionCookie(
            cookie[authSessionCookieName],
            authSessionToken,
            secure,
        );

        return redirect("/admin", 303);
    },
    {
        body: t.Object({
            password: t.Optional(t.String()),
        }),
    },
);
