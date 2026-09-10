import { afterAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Elysia } from "elysia";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "gift-shop-auth-"));
const databasePath = join(temporaryDirectory, "test.sqlite");
const originalNodeEnvironment = process.env.NODE_ENV;
process.env.DB_FILE_NAME = databasePath;
process.env.ADMIN_PASSWORD = "correct-password";
process.env.NODE_ENV = "development";

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
const { auth } = await import("./index");
const { pages } = await import("../pages");
const app = new Elysia().use(pages).use(auth);

function postPassword(password: string, url = "http://localhost/auth/login") {
    return app.handle(
        new Request(url, {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ password }),
        }),
    );
}

afterAll(() => {
    if (originalNodeEnvironment === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = originalNodeEnvironment;
    }
    rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("a newly created auth session can be validated", async () => {
    const { authSession, authSessionToken } = await createAuthSession("user");

    const validatedSession = await validateAuthSessionToken(authSessionToken);

    expect(validatedSession).not.toBeNull();
    expect(validatedSession?.id).toBe(authSession.id);
    expect(validatedSession?.secretHash).toEqual(authSession.secretHash);
});

test("a failed login redirects back and displays an error", async () => {
    const response = await postPassword("wrong-password");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/login?error=1");
    expect(response.headers.get("set-cookie")).toBeNull();

    const errorPage = await app.handle(
        new Request("http://localhost/admin/login?error=1"),
    );
    const html = await errorPage.text();

    expect(html).toContain("Incorrect password.");
    expect(html).toContain('style="color: red;"');

    const unrelatedErrorPage = await app.handle(
        new Request("http://localhost/admin/login?error=invalid"),
    );
    expect(await unrelatedErrorPage.text()).not.toContain(
        "Incorrect password.",
    );
});

test("a successful login creates a cookie-backed admin session", async () => {
    const response = await postPassword("correct-password");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin");

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) throw new Error("login did not set a session cookie");

    expect(setCookie).toContain("auth_session=");
    expect(setCookie).toContain("Max-Age=864000");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");

    const cookie = setCookie.split(";", 1)[0];
    const adminPage = await app.handle(
        new Request("http://localhost/admin", { headers: { cookie } }),
    );
    expect(adminPage.status).toBe(200);
    expect(await adminPage.text()).toContain("Gift Shop - Admin Page");
    expect(adminPage.headers.get("set-cookie")).toContain("Max-Age=864000");

    const loginPage = await app.handle(
        new Request("http://localhost/admin/login", { headers: { cookie } }),
    );
    expect(loginPage.status).toBe(302);
    expect(loginPage.headers.get("location")).toBe("/admin");
});

test("session cookies are secure for HTTPS and production", async () => {
    const httpsResponse = await postPassword(
        "correct-password",
        "https://localhost/auth/login",
    );
    expect(httpsResponse.headers.get("set-cookie")).toContain("Secure");

    process.env.NODE_ENV = "production";
    try {
        const productionResponse = await postPassword("correct-password");
        expect(productionResponse.headers.get("set-cookie")).toContain(
            "Secure",
        );
    } finally {
        process.env.NODE_ENV = "development";
    }
});

test("the admin page safely rejects missing and invalid cookies", async () => {
    const missingCookieResponse = await app.handle(
        new Request("http://localhost/admin"),
    );
    expect(missingCookieResponse.status).toBe(302);
    expect(missingCookieResponse.headers.get("location")).toBe("/admin/login");

    const invalidCookieResponse = await app.handle(
        new Request("http://localhost/admin", {
            headers: { cookie: "auth_session=invalid" },
        }),
    );
    expect(invalidCookieResponse.status).toBe(302);
    expect(invalidCookieResponse.headers.get("location")).toBe("/admin/login");
});
