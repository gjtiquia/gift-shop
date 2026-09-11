import { eq } from "drizzle-orm";
import { authSessionsTable, db } from "../db";

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

    const id = generateRandomId();

    // Generate 32 random bytes.
    // Always use a cryptographically-secure random source.
    const secret = new Uint8Array(32);
    crypto.getRandomValues(secret);

    // It's important to use a cryptographically-secure random source.
    const secretHashBuffer = await crypto.subtle.digest("SHA-256", secret);
    const secretHash = new Uint8Array(secretHashBuffer);

    const token = id + "." + secret.toBase64();

    const authSession: AuthSession = {
        id,
        secretHash,
        tokenLastVerifiedAt: now,
        createdAt: now,
    };

    // Replace this with your own database query.
    await addAuthSessionToDatabase(authSession);

    const authSessionAndAuthSessionToken: AuthSessionAndAuthSessionToken = {
        authSession,
        authSessionToken: token,
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

    const tokenParts = authSessionToken.split(".");
    if (tokenParts.length !== 2) {
        return null;
    }
    const authSessionId = tokenParts[0];
    const encodedAuthSessionSecret = tokenParts[1];

    let authSessionSecret: Uint8Array<ArrayBuffer>;
    try {
        // Uint8Array.fromBase64() was recently added to JavaScript.
        authSessionSecret = Uint8Array.fromBase64(encodedAuthSessionSecret);
    } catch {
        return null;
    }

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

    const authSessionSecretHashBuffer = await crypto.subtle.digest(
        "SHA-256",
        authSessionSecret,
    );
    const authSessionSecretHash = new Uint8Array(authSessionSecretHashBuffer);
    // Prevent any possibility of a timing attack by using a constant-time comparison.
    const secretCorrect = constantTimeEqual(
        authSessionSecretHash,
        authSession.secretHash,
    );
    if (!secretCorrect) {
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

// Returns a random alphanumeric string with 80 bits of entropy.
function generateRandomId(): string {
    // Human readable alphabet (a-z, 0-9 without l, o, 0, 1 to avoid confusion).
    const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";

    // Generate 16 random bytes.
    // We're only going to use 5 bits per byte so the total entropy will be 128 * 5 / 8 = 80 bits.
    const bytes = new Uint8Array(16);

    // It's important to use a cryptographically-secure random source.
    crypto.getRandomValues(bytes);

    let id = "";
    for (let i = 0; i < bytes.length; i++) {
        // >> 3 "removes" the right-most 3 bits of the byte, leaving us with 5 bits (0-31).
        id += alphabet[bytes[i] >> 3];
    }
    return id;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    let c = 0;
    for (let i = 0; i < a.byteLength; i++) {
        c |= a[i] ^ b[i];
    }
    return c === 0;
}
