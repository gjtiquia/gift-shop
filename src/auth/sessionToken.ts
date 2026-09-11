export interface SessionTokenData {
    id: string;
    secretHash: Uint8Array;
    token: string;
}

export async function createSessionToken(): Promise<SessionTokenData> {
    const id = generateRandomId();
    const secret = new Uint8Array(32);
    crypto.getRandomValues(secret);
    const secretHash = await hashSessionSecret(secret);

    return {
        id,
        secretHash,
        token: `${id}.${secret.toBase64()}`,
    };
}

export async function verifySessionToken(
    token: string,
    expectedSecretHash: Uint8Array,
) {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    let secret: Uint8Array<ArrayBuffer>;
    try {
        secret = Uint8Array.fromBase64(parts[1]);
    } catch {
        return null;
    }

    const actualSecretHash = await hashSessionSecret(secret);
    return constantTimeEqual(actualSecretHash, expectedSecretHash)
        ? { id: parts[0] }
        : null;
}

export function sessionIdFromToken(token: string) {
    const parts = token.split(".");
    return parts.length === 2 && parts[0] ? parts[0] : null;
}

async function hashSessionSecret(secret: Uint8Array<ArrayBuffer>) {
    const hash = await crypto.subtle.digest("SHA-256", secret);
    return new Uint8Array(hash);
}

// Human-readable alphabet with 80 bits of entropy, following Lucia's session design.
function generateRandomId() {
    const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    let id = "";
    for (const byte of bytes) id += alphabet[byte >> 3];
    return id;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
    if (a.byteLength !== b.byteLength) return false;
    let difference = 0;
    for (let index = 0; index < a.byteLength; index++) {
        difference |= a[index] ^ b[index];
    }
    return difference === 0;
}
