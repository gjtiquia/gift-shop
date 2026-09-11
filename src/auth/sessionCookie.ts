import type { Cookie } from "elysia";
import { authSessionExpiresInSeconds, validateAuthSessionToken } from "./lucia";

export const authSessionCookieName = "auth_session";

function isSecureRequest(request: Request) {
    return new URL(request.url).protocol === "https:";
}

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
        secure: isSecureRequest(request),
        maxAge: authSessionExpiresInSeconds,
    });
}

export function clearAuthSessionCookie(
    cookie: Cookie<unknown>,
    request: Request,
) {
    cookie.set({
        value: "",
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureRequest(request),
        maxAge: 0,
        expires: new Date(0),
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
