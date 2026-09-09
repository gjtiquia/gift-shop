import { eq } from "drizzle-orm";
import { authSessionsTable, db } from "../db";

async function addAuthSessionToDatabase(authSession: AuthSession) {
    // TODO :
}

async function getAuthSessionFromDatabase(
    authSessionIdString: string,
): Promise<AuthSession | null> {


    // TODO : if auth session id string is not number, return null
    // TODO : else, authSessionId

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

    // TODO : fix the types
    return { ...session, secretHash: session.secretHashBuffer };
}

async function updateAuthSessionInDatabase(authSession: AuthSession) {
    // TODO :
}

// ---

interface AuthSession {
    id: string;
    secretHash: Uint8Array;
    tokenLastVerifiedAt: Date;
    createdAt: Date;
}

const authSessionExpiresInSeconds = 60 * 60 * 24 * 10; // 10 days

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
        await updateAuthSessionInDatabase(authSession);
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
