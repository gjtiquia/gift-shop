import { afterAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Elysia } from "elysia";
import { createTemporaryDatabase } from "../test/tempDbForTests";

const temporaryDatabase = createTemporaryDatabase("gift-shop-auth-");
const databasePath = temporaryDatabase.databasePath;
process.env.DB_FILE_NAME = databasePath;
process.env.ADMIN_PASSWORD = "correct-password";

const { createAuthSession, validateAuthSessionToken } = await import("./lucia");
const { auth } = await import("./index");
const { api } = await import("../api");
const { pages } = await import("../pages");
const app = new Elysia().use(pages).use(auth).use(api);

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
        .query("UPDATE auth_sessions_table SET lastVerifiedAt = ? WHERE id = ?")
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
    temporaryDatabase.cleanup();
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

test("inventory mutations require auth and same-origin CSRF metadata", async () => {
    const form = new URLSearchParams({
        name: "Test gift",
        price: "9.99",
        quantity: "2",
        adminNotes: "",
    });
    const unauthenticatedResponse = await app.handle(
        new Request("http://localhost/api/inventory", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "Sec-Fetch-Site": "same-origin",
            },
            body: form,
        }),
    );
    expect(unauthenticatedResponse.status).toBe(303);
    expect(unauthenticatedResponse.headers.get("location")).toBe(
        "/admin/login",
    );

    const loginResponse = await postPassword("correct-password");
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("login did not set a session cookie");

    const crossSiteResponse = await app.handle(
        new Request("http://localhost/api/inventory", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "Sec-Fetch-Site": "cross-site",
                cookie,
            },
            body: form,
        }),
    );
    expect(crossSiteResponse.status).toBe(403);

    const invalidIdResponse = await app.handle(
        new Request("http://localhost/api/inventory/not-an-id/delete", {
            method: "POST",
            headers: {
                "Sec-Fetch-Site": "same-origin",
                cookie,
            },
        }),
    );
    expect(invalidIdResponse.status).toBe(303);
    expect(invalidIdResponse.headers.get("location")).toBe(
        "/admin?error=invalid-input",
    );
});

test("an admin can create, update, and delete inventory", async () => {
    const loginResponse = await postPassword("correct-password");
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("login did not set a session cookie");

    const headers = {
        "content-type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Site": "same-origin",
        cookie,
    };
    const createResponse = await app.handle(
        new Request("http://localhost/api/inventory", {
            method: "POST",
            headers,
            body: new URLSearchParams({
                name: "Test gift",
                price: "9.99",
                quantity: "2",
                adminNotes: "Fragile",
            }),
        }),
    );
    expect(createResponse.status).toBe(303);
    expect(createResponse.headers.get("location")).toBe("/admin");

    const database = new Database(databasePath);
    const created = database
        .query<
            {
                id: number;
                name: string;
                priceCentsX10: number;
                quantity: number;
                adminNotes: string | null;
            },
            []
        >(
            "SELECT id, name, priceCentsX10, quantity, adminNotes FROM inventory_table LIMIT 1",
        )
        .get();
    expect(created).toMatchObject({
        name: "Test gift",
        priceCentsX10: 999,
        quantity: 2,
        adminNotes: "Fragile",
    });
    if (!created) throw new Error("inventory was not created");

    const updateResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "POST",
            headers,
            body: new URLSearchParams({
                name: "Updated gift",
                price: "12.50",
                quantity: "0",
                adminNotes: "",
            }),
        }),
    );
    expect(updateResponse.status).toBe(303);
    expect(updateResponse.headers.get("location")).toBe("/admin");
    expect(
        database
            .query<
                {
                    name: string;
                    priceCentsX10: number;
                    quantity: number;
                    adminNotes: string | null;
                },
                [number]
            >(
                "SELECT name, priceCentsX10, quantity, adminNotes FROM inventory_table WHERE id = ?",
            )
            .get(created.id),
    ).toEqual({
        name: "Updated gift",
        priceCentsX10: 1250,
        quantity: 0,
        adminNotes: null,
    });

    const invalidResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "POST",
            headers,
            body: new URLSearchParams({
                name: "Invalid gift",
                price: "-1.00",
                quantity: "1.5",
            }),
        }),
    );
    expect(invalidResponse.status).toBe(303);
    expect(invalidResponse.headers.get("location")).toBe(
        "/admin?error=invalid-input",
    );

    const catalogueResponse = await app.handle(
        new Request("http://localhost/"),
    );
    const catalogueHtml = await catalogueResponse.text();
    expect(catalogueHtml).toContain("Updated gift");
    expect(catalogueHtml).toContain("12.50");
    expect(catalogueHtml).toContain("Out of stock");

    const adminResponse = await app.handle(
        new Request("http://localhost/admin", { headers: { cookie } }),
    );
    const adminHtml = await adminResponse.text();
    expect(adminHtml).toContain(`/api/inventory/${created.id}`);
    expect(adminHtml).toContain("Delete this item?");

    const deleteResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}/delete`, {
            method: "POST",
            headers,
        }),
    );
    expect(deleteResponse.status).toBe(303);
    expect(
        database
            .query<{ count: number }, []>(
                "SELECT COUNT(*) AS count FROM inventory_table",
            )
            .get()?.count,
    ).toBe(0);
    database.close();
});
