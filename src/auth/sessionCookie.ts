import type { Cookie } from "elysia";
import { authSessionExpiresInSeconds, validateAuthSessionToken } from "./lucia";

export const authSessionCookieName = "auth_session";

export function setAuthSessionCookie(
    cookie: Cookie<unknown>,
    authSessionToken: string,
    request: Request,
) {
    cookie.set({
        value: authSessionToken,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure:
            process.env.NODE_ENV === "production" ||
            new URL(request.url).protocol === "https:",
        maxAge: authSessionExpiresInSeconds,
    });
}

export async function validateAuthSessionCookie(
    cookie: Cookie<unknown>,
    request: Request,
) {
    const cookieValue = cookie.value;
    if (typeof cookieValue !== "string" || cookieValue.length === 0) {
        return null;
    }

    try {
        const session = await validateAuthSessionToken(cookieValue);
        if (session) setAuthSessionCookie(cookie, cookieValue, request);
        return session;
    } catch {
        return null;
    }
}
