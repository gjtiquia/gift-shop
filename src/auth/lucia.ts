import { eq } from "drizzle-orm";
import { authSessionsTable, db } from "../db";
import {
    createSessionToken,
    sessionIdFromToken,
    verifySessionToken,
} from "./sessionToken";

async function addAuthSessionToDatabase(authSession: AuthSession) {
    await db.insert(authSessionsTable).values({
        id: authSession.id,
        secretHash: Buffer.from(authSession.secretHash),
        createdAt: authSession.createdAt,
        lastVerifiedAt: authSession.tokenLastVerifiedAt,
    });
}

async function getAuthSessionFromDatabase(
    authSessionId: string,
): Promise<AuthSession | null> {
    const sessions = await db
        .select({
            id: authSessionsTable.id,
            secretHashBuffer: authSessionsTable.secretHash,
            tokenLastVerifiedAt: authSessionsTable.lastVerifiedAt,
            createdAt: authSessionsTable.createdAt,
        })
        .from(authSessionsTable)
        .where(eq(authSessionsTable.id, authSessionId));

    if (sessions.length !== 1) return null;

    const session = sessions[0];
    if (!(session.secretHashBuffer instanceof Uint8Array)) return null;

    return {
        id: session.id,
        secretHash: new Uint8Array(session.secretHashBuffer),
        tokenLastVerifiedAt: session.tokenLastVerifiedAt,
        createdAt: session.createdAt,
    };
}

async function updateAuthSessionLastVerifiedAtInDatabase(
    authSession: AuthSession,
) {
    await db
        .update(authSessionsTable)
        .set({ lastVerifiedAt: authSession.tokenLastVerifiedAt })
        .where(eq(authSessionsTable.id, authSession.id));
}

export async function deleteAuthSession(authSessionId: string) {
    await db
        .delete(authSessionsTable)
        .where(eq(authSessionsTable.id, authSessionId));
}

// ---

/*
For an explanation on sessions: https://auth.pilcrowonpaper.com/sessions
For an in-depth explanation on sessions: https://auth.pilcrowonpaper.com/auth-sessions
Watch out for CSRF vulnerabilities: https://auth.pilcrowonpaper.com/csrf

The auth session will be valid for 10 days.
If the token is validated during that period, the expiration is extended.

The session model with have 5 properties:
- ID
- User ID
- Secret hash (binary data)
- Token last verified at timestamp
- Created at timestamp

For, SQLite, your database may look like this:

    CREATE TABLE user (
        id TEXT NOT NULL PRIMARY KEY
    ) STRICT;

    CREATE TABLE auth_session (
        id TEXT NOT NULL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id),
        secret_hash BLOB NOT NULL, -- blob is a SQLite data type for raw binary
        token_last_verified_at INTEGER NOT NULL, -- unix time (seconds)
        created_at INTEGER NOT NULL -- unix time (seconds)
    ) STRICT;

CSRF PROTECTION MUST BE IMPLEMENTED IF THE SESSION TOKEN IS STORED IN A COOKIE.
Frameworks like SvelteKit and Astro have CSRF protection enabled by default.
A simple method is to check the Sec-Fetch-Site request header on non-GET requests.

	if (request.method !== "GET" && request.method !== "HEAD") {
		const secFetchSiteHeader = request.headers.get("Sec-Fetch-Site");
	    if (secFetchSiteHeader === null) {
		    return new Response(null, { status: 403 });
	    }
	    if (secFetchSiteHeader !== "same-origin") {
            return new Response(null, { status: 403 });
	    }
	}

Uint8Array.toBase64() are supported on Node.js 25, the latest version of Deno, and the latest version of Deno.

This file is licensed under the Zero-Clause BSD license (see ./LICENSE).
You're free to use, copy, modify, and distribute it without any attribution.
*/

interface AuthSession {
    id: string;
    secretHash: Uint8Array;
    tokenLastVerifiedAt: Date;
    createdAt: Date;
}

export const authSessionExpiresInSeconds = 60 * 60 * 24 * 10; // 10 days

// Create a new session after the user signs in.
// Store the session token in a cookie with the following attributes:
// - Path: /
// - Expires: authSessionExpiresInSeconds (or whatever you've set the expiration to in seconds)
// - Secure (if your website uses HTTPS)
// - HttpOnly
// - Same-Site: Lax
export async function createAuthSession(
    userId: string,
): Promise<AuthSessionAndAuthSessionToken> {
    const now = new Date();

    const sessionToken = await createSessionToken();

    const authSession: AuthSession = {
        id: sessionToken.id,
        secretHash: sessionToken.secretHash,
        tokenLastVerifiedAt: now,
        createdAt: now,
    };

    // Replace this with your own database query.
    await addAuthSessionToDatabase(authSession);

    const authSessionAndAuthSessionToken: AuthSessionAndAuthSessionToken = {
        authSession,
        authSessionToken: sessionToken.token,
    };

    return authSessionAndAuthSessionToken;
}

interface AuthSessionAndAuthSessionToken {
    authSession: AuthSession;
    authSessionToken: string;
}

// Read the session token cookie from the request and validate it.
// If the validation is successful, set a new session cookie (override the existing one)
// to extend the cookie expiration.
export async function validateAuthSessionToken(
    authSessionToken: string,
): Promise<AuthSession | null> {
    const now = new Date();

    const authSessionId = sessionIdFromToken(authSessionToken);
    if (!authSessionId) return null;

    // Replace this with your own database query.
    const authSession = await getAuthSessionFromDatabase(authSessionId);

    // If the record doesn't exist in the database, the ID is invalid.
    if (authSession === null) {
        return null;
    }

    // Check for expiration.
    if (
        now.getTime() - authSession.tokenLastVerifiedAt.getTime() >=
        authSessionExpiresInSeconds * 1000
    ) {
        return null;
    }

    if (!(await verifySessionToken(authSessionToken, authSession.secretHash))) {
        return null;
    }

    // If at least an hour past since last token verification, update the token last verified at timestamp.
    // This pushes back the expiration.
    if (
        now.getTime() - authSession.tokenLastVerifiedAt.getTime() >=
        60 * 60 * 1000
    ) {
        authSession.tokenLastVerifiedAt = now;

        // Replace this with your own database query.
        await updateAuthSessionLastVerifiedAtInDatabase(authSession);
    }

    return authSession;
}
