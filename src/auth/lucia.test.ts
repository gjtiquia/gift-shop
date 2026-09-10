import { afterAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Elysia } from "elysia";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "gift-shop-auth-"));
const databasePath = join(temporaryDirectory, "test.sqlite");
process.env.DB_FILE_NAME = databasePath;
process.env.ADMIN_PASSWORD = "correct-password";

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

function postPassword(
    password: string,
    url = "http://localhost/auth/login",
    secFetchSite: string | null = "same-origin",
) {
    const headers = new Headers({
        "content-type": "application/x-www-form-urlencoded",
    });
    if (secFetchSite) headers.set("Sec-Fetch-Site", secFetchSite);

    return app.handle(
        new Request(url, {
            method: "POST",
            headers,
            body: new URLSearchParams({ password }),
        }),
    );
}

function setSessionLastVerifiedAt(authSessionToken: string, date: Date) {
    const database = new Database(databasePath);
    database
        .query(
            "UPDATE auth_sessions_table SET lastVerifiedAt = ? WHERE id = ?",
        )
        .run(date.getTime(), authSessionToken.split(".")[0]);
    database.close();
}

function getSessionLastVerifiedAt(authSessionToken: string) {
    const database = new Database(databasePath);
    const row = database
        .query<{ lastVerifiedAt: number }, [string]>(
            "SELECT lastVerifiedAt FROM auth_sessions_table WHERE id = ?",
        )
        .get(authSessionToken.split(".")[0]);
    database.close();
    return row?.lastVerifiedAt;
}

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

test("login rejects requests without same-origin CSRF metadata", async () => {
    const missingHeaderResponse = await postPassword(
        "correct-password",
        undefined,
        null,
    );
    expect(missingHeaderResponse.status).toBe(403);
    expect(missingHeaderResponse.headers.get("set-cookie")).toBeNull();

    const crossSiteResponse = await postPassword(
        "correct-password",
        undefined,
        "cross-site",
    );
    expect(crossSiteResponse.status).toBe(403);
    expect(crossSiteResponse.headers.get("set-cookie")).toBeNull();
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

test("session cookies are secure for HTTPS", async () => {
    const httpsResponse = await postPassword(
        "correct-password",
        "https://localhost/auth/login",
    );
    expect(httpsResponse.headers.get("set-cookie")).toContain("Secure");
});

test("expired sessions are rejected", async () => {
    const { authSessionToken } = await createAuthSession("admin");
    setSessionLastVerifiedAt(
        authSessionToken,
        new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
    );

    const response = await app.handle(
        new Request("http://localhost/admin", {
            headers: {
                cookie: `auth_session=${encodeURIComponent(authSessionToken)}`,
            },
        }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/login");
});

test("active sessions persist sliding expiration and renew the cookie", async () => {
    const { authSessionToken } = await createAuthSession("admin");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    setSessionLastVerifiedAt(authSessionToken, twoHoursAgo);

    const response = await app.handle(
        new Request("http://localhost/admin", {
            headers: {
                cookie: `auth_session=${encodeURIComponent(authSessionToken)}`,
            },
        }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=864000");
    expect(getSessionLastVerifiedAt(authSessionToken)).toBeGreaterThan(
        twoHoursAgo.getTime(),
    );
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
