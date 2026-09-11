import type { Cookie } from "elysia";
import { eq } from "drizzle-orm";
import { db, visitorSessionsTable } from "../db";
import {
    createSessionToken,
    sessionIdFromToken,
    verifySessionToken,
} from "./lucia";

export const visitorSessionCookieName = "visitor_session";
export const visitorSessionCookieMaxAgeSeconds = 60 * 60 * 24 * 400;

export interface VisitorSession {
    id: string;
    createdAt: Date;
    lastMutatedAt: Date;
}

export async function getVisitorSessionForRead(
    cookie: Cookie<unknown>,
    request: Request,
) {
    const token = typeof cookie.value === "string" ? cookie.value : "";
    const session = token ? await validateVisitorSessionToken(token) : null;
    // Valid reads extend the browser cookie without mutating server state.
    if (session) setVisitorSessionCookie(cookie, token, request);
    return session;
}

export async function getOrCreateVisitorSessionForMutation(
    cookie: Cookie<unknown>,
    request: Request,
) {
    const token = typeof cookie.value === "string" ? cookie.value : "";
    const session = token ? await validateVisitorSessionToken(token) : null;
    const now = new Date();
    if (session) {
        await db
            .update(visitorSessionsTable)
            .set({ lastMutatedAt: now })
            .where(eq(visitorSessionsTable.id, session.id));
        setVisitorSessionCookie(cookie, token, request);
        return { ...session, lastMutatedAt: now };
    }

    const created = await createSessionToken();
    await db.insert(visitorSessionsTable).values({
        id: created.id,
        secretHash: Buffer.from(created.secretHash),
        createdAt: now,
        lastMutatedAt: now,
    });
    setVisitorSessionCookie(cookie, created.token, request);
    return { id: created.id, createdAt: now, lastMutatedAt: now };
}

async function validateVisitorSessionToken(token: string) {
    const id = sessionIdFromToken(token);
    if (!id) return null;

    const [stored] = await db
        .select({
            id: visitorSessionsTable.id,
            secretHash: visitorSessionsTable.secretHash,
            createdAt: visitorSessionsTable.createdAt,
            lastMutatedAt: visitorSessionsTable.lastMutatedAt,
        })
        .from(visitorSessionsTable)
        .where(eq(visitorSessionsTable.id, id))
        .limit(1);
    if (!stored || !(stored.secretHash instanceof Uint8Array)) return null;
    if (!(await verifySessionToken(token, stored.secretHash))) return null;

    return {
        id: stored.id,
        createdAt: stored.createdAt,
        lastMutatedAt: stored.lastMutatedAt,
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
