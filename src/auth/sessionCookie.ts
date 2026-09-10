import type { Cookie } from "elysia";
import { authSessionExpiresInSeconds, validateAuthSessionToken } from "./lucia";

export const authSessionCookieName = "auth_session";

export function setAuthSessionCookie(
    cookie: Cookie<unknown>,
    authSessionToken: string,
    secure: boolean,
) {
    cookie.set({
        value: authSessionToken,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: authSessionExpiresInSeconds,
    });
}

export async function validateAuthSessionCookie(
    cookie: Cookie<unknown>,
    secure: boolean,
) {
    const cookieValue = cookie.value;
    if (typeof cookieValue !== "string" || cookieValue.length === 0) {
        return null;
    }

    try {
        const session = await validateAuthSessionToken(cookieValue);
        if (session) setAuthSessionCookie(cookie, cookieValue, secure);
        return session;
    } catch {
        return null;
    }
}
