import type { Cookie } from "elysia";
import { eq } from "drizzle-orm";
import { db, visitorSessionsTable } from "../db";
import {
    createSessionToken,
    sessionIdFromToken,
    verifySessionToken,
} from "../auth/sessionToken";

export const visitorSessionCookieName = "visitor_session";
export const visitorSessionCookieMaxAgeSeconds = 60 * 60 * 24 * 400;

export interface VisitorSession {
    id: string;
    createdAt: Date;
    lastSeenAt: Date;
}

export async function getOrCreateVisitorSession(
    cookie: Cookie<unknown>,
    request: Request,
) {
    const token = typeof cookie.value === "string" ? cookie.value : "";
    const session = token ? await validateVisitorSessionToken(token) : null;
    if (session) {
        const now = new Date();
        await db
            .update(visitorSessionsTable)
            .set({ lastSeenAt: now })
            .where(eq(visitorSessionsTable.id, session.id));
        setVisitorSessionCookie(cookie, token, request);
        return { ...session, lastSeenAt: now };
    }

    const created = await createSessionToken();
    const now = new Date();
    await db.insert(visitorSessionsTable).values({
        id: created.id,
        secretHash: Buffer.from(created.secretHash),
        createdAt: now,
        lastSeenAt: now,
    });
    setVisitorSessionCookie(cookie, created.token, request);
    return { id: created.id, createdAt: now, lastSeenAt: now };
}

export async function validateVisitorSessionToken(token: string) {
    const id = sessionIdFromToken(token);
    if (!id) return null;

    const [stored] = await db
        .select({
            id: visitorSessionsTable.id,
            secretHash: visitorSessionsTable.secretHash,
            createdAt: visitorSessionsTable.createdAt,
            lastSeenAt: visitorSessionsTable.lastSeenAt,
        })
        .from(visitorSessionsTable)
        .where(eq(visitorSessionsTable.id, id))
        .limit(1);
    if (!stored || !(stored.secretHash instanceof Uint8Array)) return null;
    if (!(await verifySessionToken(token, stored.secretHash))) return null;

    return {
        id: stored.id,
        createdAt: stored.createdAt,
        lastSeenAt: stored.lastSeenAt,
    };
}

function setVisitorSessionCookie(
    cookie: Cookie<unknown>,
    token: string,
    request: Request,
) {
    cookie.set({
        value: token,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: new URL(request.url).protocol === "https:",
        maxAge: visitorSessionCookieMaxAgeSeconds,
    });
}
