import { afterAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "gift-shop-auth-"));
const databasePath = join(temporaryDirectory, "test.sqlite");
process.env.DB_FILE_NAME = databasePath;

const sqlite = new Database(databasePath);
sqlite.exec(`
    CREATE TABLE auth_sessions_table (
        id TEXT PRIMARY KEY NOT NULL,
        secretHash BLOB NOT NULL,
        createdAt INTEGER NOT NULL,
        lastVerifiedAt INTEGER NOT NULL
    )
`);
sqlite.close();

const { createAuthSession, validateAuthSessionToken } = await import("./lucia");

afterAll(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("a newly created auth session can be validated", async () => {
    const { authSession, authSessionToken } = await createAuthSession("user");

    const validatedSession = await validateAuthSessionToken(authSessionToken);

    expect(validatedSession).not.toBeNull();
    expect(validatedSession?.id).toBe(authSession.id);
    expect(validatedSession?.secretHash).toEqual(authSession.secretHash);
});
