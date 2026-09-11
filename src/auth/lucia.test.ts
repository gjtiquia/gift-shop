import { afterAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Elysia } from "elysia";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
    imageDataDirectory,
    maximumImageSizeBytes,
} from "../api/images/storage";
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
    origin: string | null = null,
) {
    const headers = new Headers({
        "content-type": "application/x-www-form-urlencoded",
    });
    if (secFetchSite) headers.set("Sec-Fetch-Site", secFetchSite);
    if (origin) headers.set("Origin", origin);

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

    const sameOriginFallbackResponse = await postPassword(
        "correct-password",
        "http://192.168.1.20/auth/login",
        null,
        "http://192.168.1.20",
    );
    expect(sameOriginFallbackResponse.status).toBe(303);

    const crossOriginFallbackResponse = await postPassword(
        "correct-password",
        undefined,
        null,
        "http://example.com",
    );
    expect(crossOriginFallbackResponse.status).toBe(403);
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
    expect(html).toContain('class="text-sm font-medium text-red-700"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("/public/htmx.min.js");

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
    const adminHtml = await adminPage.text();
    expect(adminHtml).toContain("Gift Shop - Admin Page");
    expect(adminHtml).not.toContain("data-reset-after-success");
    expect(adminHtml).not.toContain("hx-post=");
    expect(adminHtml).toContain("/public/index.js");
    expect(adminHtml).toMatch(
        /<script[^>]*defer[^>]*src="\/public\/htmx\.min\.js"/,
    );
    expect(adminPage.headers.get("set-cookie")).toContain("Max-Age=864000");

    const loginPage = await app.handle(
        new Request("http://localhost/admin/login", { headers: { cookie } }),
    );
    expect(loginPage.status).toBe(302);
    expect(loginPage.headers.get("location")).toBe("/admin");
});

test("an admin can log out", async () => {
    const { authSessionToken } = await createAuthSession("admin");
    const cookie = `auth_session=${encodeURIComponent(authSessionToken)}`;

    const adminPage = await app.handle(
        new Request("http://localhost/admin", { headers: { cookie } }),
    );
    expect(await adminPage.text()).toContain('action="/auth/logout"');

    const logoutResponse = await app.handle(
        new Request("http://localhost/auth/logout", {
            method: "POST",
            headers: { cookie, "Sec-Fetch-Site": "same-origin" },
        }),
    );

    expect(logoutResponse.status).toBe(303);
    expect(logoutResponse.headers.get("location")).toBe("/admin/login");
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await validateAuthSessionToken(authSessionToken)).toBeNull();

    const loggedOutAdminPage = await app.handle(
        new Request("http://localhost/admin", { headers: { cookie } }),
    );
    expect(loggedOutAdminPage.status).toBe(302);
    expect(loggedOutAdminPage.headers.get("location")).toBe("/admin/login");
});

test("logout rejects requests without same-origin CSRF metadata", async () => {
    const { authSessionToken } = await createAuthSession("admin");
    const response = await app.handle(
        new Request("http://localhost/auth/logout", {
            method: "POST",
            headers: {
                cookie: `auth_session=${encodeURIComponent(authSessionToken)}`,
                "Sec-Fetch-Site": "cross-site",
            },
        }),
    );

    expect(response.status).toBe(403);
    expect(await validateAuthSessionToken(authSessionToken)).not.toBeNull();
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
        new Request("http://localhost/api/inventory/not-an-id", {
            method: "DELETE",
            headers: {
                "Sec-Fetch-Site": "same-origin",
                "HX-Request": "true",
                cookie,
            },
        }),
    );
    expect(invalidIdResponse.status).toBe(422);
    expect(invalidIdResponse.headers.get("HX-Retarget")).toBe(
        "#inventory-error",
    );
});

test("an admin can create and update inventory without an image", async () => {
    const loginResponse = await postPassword("correct-password");
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("login did not set a session cookie");

    const headers = {
        "content-type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Site": "same-origin",
        "HX-Request": "true",
        cookie,
    };
    const createForm = new FormData();
    createForm.set("name", "Test gift");
    createForm.set("price", "9.99");
    createForm.set("quantity", "2");
    createForm.set("adminNotes", "Fragile");
    createForm.set("image", new File([], ""));
    const createResponse = await app.handle(
        new Request("http://localhost/api/inventory", {
            method: "POST",
            headers: {
                "Sec-Fetch-Site": "same-origin",
                cookie,
            },
            body: createForm,
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
                imageId: number | null;
                adminNotes: string | null;
            },
            []
        >(
            "SELECT id, name, priceCentsX10, quantity, imageId, adminNotes FROM inventory_table LIMIT 1",
        )
        .get();
    expect(created).toMatchObject({
        name: "Test gift",
        priceCentsX10: 999,
        quantity: 2,
        imageId: null,
        adminNotes: "Fragile",
    });
    if (!created) throw new Error("inventory was not created");

    const updateResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "PUT",
            headers,
            body: new URLSearchParams({
                name: "Updated gift",
                price: "12.50",
                quantity: "0",
                adminNotes: "",
            }),
        }),
    );
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.text()).toContain("Updated gift");
    expect(
        database
            .query<
                {
                    name: string;
                    priceCentsX10: number;
                    quantity: number;
                    imageId: number | null;
                    adminNotes: string | null;
                },
                [number]
            >(
                "SELECT name, priceCentsX10, quantity, imageId, adminNotes FROM inventory_table WHERE id = ?",
            )
            .get(created.id),
    ).toEqual({
        name: "Updated gift",
        priceCentsX10: 1250,
        quantity: 0,
        imageId: null,
        adminNotes: null,
    });

    const invalidResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "PUT",
            headers,
            body: new URLSearchParams({
                name: "Invalid gift",
                price: "-1.00",
                quantity: "1.5",
            }),
        }),
    );
    expect(invalidResponse.status).toBe(422);
    expect(invalidResponse.headers.get("HX-Retarget")).toBe("#inventory-error");

    const catalogueResponse = await app.handle(
        new Request("http://localhost/"),
    );
    const catalogueHtml = await catalogueResponse.text();
    expect(catalogueHtml).toContain("/public/htmx.min.js");
    expect(catalogueHtml).toContain("Updated gift");
    expect(catalogueHtml).toContain("12.50");
    expect(catalogueHtml).toContain("Out of stock");

    const adminResponse = await app.handle(
        new Request("http://localhost/admin", { headers: { cookie } }),
    );
    const adminHtml = await adminResponse.text();
    expect(adminHtml).not.toContain(`hx-put="/api/inventory/${created.id}"`);
    expect(adminHtml).toContain(`method="post"`);
    expect(adminHtml).toContain(`action="/api/inventory/${created.id}"`);
    expect(adminHtml).toContain(`hx-delete="/api/inventory/${created.id}"`);
    expect(adminHtml).toContain(
        `aria-label="Name for inventory item ${created.id}"`,
    );
    expect(adminHtml).toContain(
        `aria-label="Price for inventory item ${created.id}"`,
    );
    expect(adminHtml).toContain(
        `aria-label="Quantity for inventory item ${created.id}"`,
    );
    expect(adminHtml).toContain(
        `aria-label="Notes for inventory item ${created.id}"`,
    );
    expect(adminHtml).toContain("Delete this item?");

    const deleteResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "DELETE",
            headers,
        }),
    );
    expect(deleteResponse.status).toBe(200);
    expect(
        database
            .query<{ count: number }, []>(
                "SELECT COUNT(*) AS count FROM inventory_table",
            )
            .get()?.count,
    ).toBe(0);
    database.close();
});

test("an admin can add, replace, and retrieve an inventory image", async () => {
    const loginResponse = await postPassword("correct-password");
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("login did not set a session cookie");

    const requestInventory = (
        method: "POST" | "PUT",
        url: string,
        body: FormData,
    ) =>
        app.handle(
            new Request(url, {
                method,
                headers: {
                    "Sec-Fetch-Site": "same-origin",
                    "HX-Request": "true",
                    cookie,
                },
                body,
            }),
        );
    const inventoryForm = (name: string) => {
        const form = new FormData();
        form.set("name", name);
        form.set("price", "8.00");
        form.set("quantity", "1");
        return form;
    };

    const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const createForm = inventoryForm("Image gift");
    createForm.set(
        "image",
        new File([png], "untrusted.jpg", { type: "image/jpeg" }),
    );
    const createResponse = await requestInventory(
        "POST",
        "http://localhost/api/inventory",
        createForm,
    );
    expect(createResponse.status).toBe(201);

    const database = new Database(databasePath);
    const created = database
        .query<{ id: number; imageId: number }, [string]>(
            "SELECT id, imageId FROM inventory_table WHERE name = ?",
        )
        .get("Image gift");
    if (!created) throw new Error("inventory image was not created");

    const firstImage = database
        .query<{ filename: string }, [number]>(
            "SELECT filename FROM images_table WHERE id = ?",
        )
        .get(created.imageId);
    if (!firstImage) throw new Error("image record was not created");

    const firstImageResponse = await app.handle(
        new Request(`http://localhost/api/images/${created.imageId}`),
    );
    expect(firstImageResponse.status).toBe(200);
    expect(firstImageResponse.headers.get("content-type")).toBe("image/png");
    expect(firstImageResponse.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
    );
    expect(firstImageResponse.headers.get("x-content-type-options")).toBe(
        "nosniff",
    );
    expect(new Uint8Array(await firstImageResponse.arrayBuffer())).toEqual(png);
    expect(
        await app.handle(new Request("http://localhost/api/images/not-an-id")),
    ).toMatchObject({ status: 404 });
    expect(
        await app.handle(new Request("http://localhost/api/images/999999")),
    ).toMatchObject({ status: 404 });

    const updateWithoutImageResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "POST",
            headers: {
                "Sec-Fetch-Site": "same-origin",
                cookie,
            },
            body: inventoryForm("Image gift without replacement"),
        }),
    );
    expect(updateWithoutImageResponse.status).toBe(303);
    expect(updateWithoutImageResponse.headers.get("location")).toBe("/admin");
    expect(
        database
            .query<{ imageId: number }, [number]>(
                "SELECT imageId FROM inventory_table WHERE id = ?",
            )
            .get(created.id)?.imageId,
    ).toBe(created.imageId);
    expect(existsSync(join(imageDataDirectory, firstImage.filename))).toBe(
        true,
    );

    const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const replaceForm = inventoryForm("Image gift");
    replaceForm.set("image", new File([webp], "photo.png"));
    const replaceResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "POST",
            headers: {
                "Sec-Fetch-Site": "same-origin",
                cookie,
            },
            body: replaceForm,
        }),
    );
    expect(replaceResponse.status).toBe(303);
    expect(replaceResponse.headers.get("location")).toBe("/admin");

    const replaced = database
        .query<{ imageId: number }, [number]>(
            "SELECT imageId FROM inventory_table WHERE id = ?",
        )
        .get(created.id);
    expect(replaced?.imageId).not.toBe(created.imageId);
    expect(
        await app.handle(
            new Request(`http://localhost/api/images/${created.imageId}`),
        ),
    ).toMatchObject({ status: 404 });
    expect(existsSync(join(imageDataDirectory, firstImage.filename))).toBe(
        false,
    );

    const replacementImage = database
        .query<{ filename: string }, [number]>(
            "SELECT filename FROM images_table WHERE id = ?",
        )
        .get(replaced!.imageId);
    if (!replacementImage) throw new Error("replacement image was not created");

    const invalidForm = inventoryForm("Invalid image gift");
    invalidForm.set("image", new File(["not an image"], "fake.png"));
    const invalidResponse = await requestInventory(
        "POST",
        "http://localhost/api/inventory",
        invalidForm,
    );
    expect(invalidResponse.status).toBe(422);
    expect(await invalidResponse.text()).toContain("JPEG, PNG, or WebP");

    const oversizedForm = inventoryForm("Oversized image gift");
    oversizedForm.set(
        "image",
        new File(
            [png, new Uint8Array(maximumImageSizeBytes - png.length + 1)],
            "too-large.png",
        ),
    );
    const oversizedResponse = await requestInventory(
        "POST",
        "http://localhost/api/inventory",
        oversizedForm,
    );
    expect(oversizedResponse.status).toBe(422);
    expect(await oversizedResponse.text()).toContain("5 MB or smaller");

    const directlyDeletedForm = inventoryForm("Directly deleted image gift");
    directlyDeletedForm.set("image", new File([png], "delete-me.png"));
    expect(
        await requestInventory(
            "POST",
            "http://localhost/api/inventory",
            directlyDeletedForm,
        ),
    ).toMatchObject({ status: 201 });
    const directlyDeleted = database
        .query<{ id: number; imageId: number; filename: string }, [string]>(
            `SELECT inventory_table.id, inventory_table.imageId, images_table.filename
             FROM inventory_table
             JOIN images_table ON images_table.id = inventory_table.imageId
             WHERE inventory_table.name = ?`,
        )
        .get("Directly deleted image gift");
    if (!directlyDeleted) throw new Error("delete test image was not created");

    const directlyDeletedPath = join(
        imageDataDirectory,
        directlyDeleted.filename,
    );
    rmSync(directlyDeletedPath);
    mkdirSync(directlyDeletedPath);

    const originalConsoleError = console.error;
    console.error = () => undefined;
    let directDeleteResponse: Response;
    try {
        directDeleteResponse = await app.handle(
            new Request(
                `http://localhost/api/inventory/${directlyDeleted.id}`,
                {
                    method: "DELETE",
                    headers: {
                        "Sec-Fetch-Site": "same-origin",
                        "HX-Request": "true",
                        cookie,
                    },
                },
            ),
        );
    } finally {
        console.error = originalConsoleError;
    }
    expect(directDeleteResponse.status).toBe(200);
    expect(
        database
            .query<{ count: number }, [number]>(
                "SELECT COUNT(*) AS count FROM images_table WHERE id = ?",
            )
            .get(directlyDeleted.imageId)?.count,
    ).toBe(1);
    expect(
        await app.handle(
            new Request(
                `http://localhost/api/images/${directlyDeleted.imageId}`,
            ),
        ),
    ).toMatchObject({ status: 404 });

    rmSync(directlyDeletedPath, { recursive: true });
    const retryCleanupResponse = await requestInventory(
        "PUT",
        `http://localhost/api/inventory/${created.id}`,
        inventoryForm("Image gift"),
    );
    expect(retryCleanupResponse.status).toBe(200);
    expect(
        database
            .query<{ count: number }, [number]>(
                "SELECT COUNT(*) AS count FROM images_table WHERE id = ?",
            )
            .get(directlyDeleted.imageId)?.count,
    ).toBe(0);

    const deleteResponse = await app.handle(
        new Request(`http://localhost/api/inventory/${created.id}`, {
            method: "DELETE",
            headers: {
                "Sec-Fetch-Site": "same-origin",
                "HX-Request": "true",
                cookie,
            },
        }),
    );
    expect(deleteResponse.status).toBe(200);
    expect(
        existsSync(join(imageDataDirectory, replacementImage.filename)),
    ).toBe(false);
    expect(
        database
            .query<{ count: number }, []>(
                "SELECT COUNT(*) AS count FROM images_table",
            )
            .get()?.count,
    ).toBe(0);
    database.close();
});
