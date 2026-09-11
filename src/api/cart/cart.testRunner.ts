import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { api } from "../index";
import { pages } from "../../pages";
import {
    cartItemsTable,
    db,
    inventoryTable,
    ordersTable,
    visitorSessionsTable,
} from "../../db";
import { visitorSessionCookieMaxAgeSeconds } from "../../auth/visitorSession";

const app = new Elysia().use(pages).use(api);

function cookieFrom(response: Response) {
    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie, "response should set a visitor cookie");
    return setCookie.split(";", 1)[0];
}

function visitorId(cookie: string) {
    const token = cookie.slice(cookie.indexOf("=") + 1);
    return token.split(".")[0];
}

function request(
    path: string,
    options: {
        method?: string;
        cookie?: string;
        form?: Record<string, string>;
        htmx?: boolean;
    } = {},
) {
    const headers = new Headers();
    if (options.cookie) headers.set("cookie", options.cookie);
    if (options.method === "POST") {
        headers.set("Sec-Fetch-Site", "same-origin");
    }
    if (options.htmx) headers.set("HX-Request", "true");
    return app.handle(
        new Request(`http://localhost${path}`, {
            method: options.method,
            headers,
            body: options.form ? new URLSearchParams(options.form) : undefined,
        }),
    );
}

const firstHome = await request("/");
assert.equal(firstHome.status, 200);
const firstCookie = cookieFrom(firstHome);
const firstSetCookie = firstHome.headers.get("set-cookie")!;
assert.match(firstSetCookie, /visitor_session=/);
assert.match(firstSetCookie, /HttpOnly/);
assert.match(firstSetCookie, /SameSite=Lax/);
assert.match(firstSetCookie, /Path=\//);
assert.match(
    firstSetCookie,
    new RegExp(`Max-Age=${visitorSessionCookieMaxAgeSeconds}`),
);
assert.equal(firstSetCookie.includes("Secure"), false);
assert.equal((await db.select().from(visitorSessionsTable)).length, 1);

const renewedHome = await request("/", { cookie: firstCookie });
assert.equal(renewedHome.status, 200);
assert.match(
    renewedHome.headers.get("set-cookie") ?? "",
    new RegExp(`Max-Age=${visitorSessionCookieMaxAgeSeconds}`),
);
assert.equal(visitorId(cookieFrom(renewedHome)), visitorId(firstCookie));
assert.equal((await db.select().from(visitorSessionsTable)).length, 1);

const secureHome = await app.handle(new Request("https://localhost/"));
assert.match(secureHome.headers.get("set-cookie") ?? "", /Secure/);
const secureCookie = cookieFrom(secureHome);

const invalidHome = await request("/", { cookie: "visitor_session=invalid" });
const secondCookie = cookieFrom(invalidHome);
assert.notEqual(visitorId(secondCookie), visitorId(firstCookie));
assert.equal((await db.select().from(visitorSessionsTable)).length, 3);

const now = new Date();
const [inventory] = await db
    .insert(inventoryTable)
    .values({
        name: "Server cart gift",
        priceCentsX10: 750,
        quantity: 4,
        hidden: false,
        createdAt: now,
        lastModifiedAt: now,
    })
    .returning();

await request(`/api/cart/items/${inventory.id}/add`, {
    method: "POST",
    cookie: secureCookie,
    form: { quantity: "1" },
});
await db
    .delete(visitorSessionsTable)
    .where(eq(visitorSessionsTable.id, visitorId(secureCookie)));
assert.equal(
    (
        await db
            .select()
            .from(cartItemsTable)
            .where(eq(cartItemsTable.visitorId, visitorId(secureCookie)))
    ).length,
    0,
);

const csrfRejected = await app.handle(
    new Request(`http://localhost/api/cart/items/${inventory.id}/add`, {
        method: "POST",
        headers: { cookie: firstCookie, "Sec-Fetch-Site": "cross-site" },
        body: new URLSearchParams({ quantity: "1" }),
    }),
);
assert.equal(csrfRejected.status, 403);

const addResponse = await request(`/api/cart/items/${inventory.id}/add`, {
    method: "POST",
    cookie: firstCookie,
    form: { quantity: "2" },
    htmx: true,
});
const addHtml = await addResponse.text();
assert.equal(addResponse.status, 200, addHtml);
assert.match(addHtml, /Added/);
assert.match(addHtml, /Cart \(2\)/);
assert.match(addHtml, /hx-swap-oob="outerHTML"/);

const otherCartPage = await request("/cart", { cookie: secondCookie });
assert.match(await otherCartPage.text(), /Your cart is empty/);
const firstCartPage = await request("/cart", { cookie: firstCookie });
const firstCartHtml = await firstCartPage.text();
assert.match(firstCartHtml, /Server cart gift/);
assert.match(firstCartHtml, /id="cart-region"/);
assert.match(firstCartHtml, /name="submissionId"/);
assert.match(firstCartHtml, /hx-target="#cart-region"/);
assert.match(firstCartHtml, /#cart-region:queue all/);

const increaseResponse = await request(
    `/api/cart/items/${inventory.id}/increase`,
    { method: "POST", cookie: firstCookie, htmx: true },
);
assert.equal(increaseResponse.status, 200);
assert.equal(
    (
        await db
            .select()
            .from(cartItemsTable)
            .where(eq(cartItemsTable.visitorId, visitorId(firstCookie)))
    )[0]?.quantity,
    3,
);

const htmlInventoryName = '<img src=x onerror="alert(1)">';
await db
    .update(inventoryTable)
    .set({ name: htmlInventoryName, lastModifiedAt: new Date() })
    .where(eq(inventoryTable.id, inventory.id));
const tooManyResponse = await request(`/api/cart/items/${inventory.id}`, {
    method: "POST",
    cookie: firstCookie,
    form: { quantity: "5" },
    htmx: true,
});
assert.equal(tooManyResponse.status, 422);
assert.equal(tooManyResponse.headers.get("HX-Retarget"), "#cart-error");
assert.equal(tooManyResponse.headers.get("HX-Reswap"), "textContent");
assert.equal(
    tooManyResponse.headers.get("content-type"),
    "text/plain; charset=utf-8",
);
assert.match(await tooManyResponse.text(), /<img src=x onerror=/);
await db
    .update(inventoryTable)
    .set({ name: "Server cart gift", lastModifiedAt: new Date() })
    .where(eq(inventoryTable.id, inventory.id));

await db
    .update(inventoryTable)
    .set({ quantity: 2, lastModifiedAt: new Date() })
    .where(eq(inventoryTable.id, inventory.id));
const failedCheckout = await request("/api/orders", {
    method: "POST",
    cookie: firstCookie,
    form: { customerName: "Kid One", submissionId: crypto.randomUUID() },
});
assert.equal(failedCheckout.status, 303);
assert.match(failedCheckout.headers.get("location") ?? "", /^\/cart\?error=/);
assert.equal(
    (
        await db
            .select()
            .from(cartItemsTable)
            .where(eq(cartItemsTable.visitorId, visitorId(firstCookie)))
    )[0]?.quantity,
    3,
);
await db
    .update(inventoryTable)
    .set({ quantity: 4, lastModifiedAt: new Date() })
    .where(eq(inventoryTable.id, inventory.id));

const submissionId = crypto.randomUUID();
const checkout = await request("/api/orders", {
    method: "POST",
    cookie: firstCookie,
    form: { customerName: "Kid One", submissionId },
});
assert.equal(checkout.status, 303);
const orderLocation = checkout.headers.get("location");
assert.match(orderLocation ?? "", /^\/orders\/[0-9a-f-]{36}$/i);
assert.equal(
    (
        await db
            .select()
            .from(cartItemsTable)
            .where(eq(cartItemsTable.visitorId, visitorId(firstCookie)))
    ).length,
    0,
);
const [createdOrder] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.submissionId, submissionId));
assert.equal(createdOrder?.visitorId, visitorId(firstCookie));
assert.equal(
    (
        await db
            .select()
            .from(inventoryTable)
            .where(eq(inventoryTable.id, inventory.id))
    )[0]?.quantity,
    4,
);

const retry = await request("/api/orders", {
    method: "POST",
    cookie: firstCookie,
    form: { customerName: "Kid One", submissionId },
});
assert.equal(retry.status, 303);
assert.equal(retry.headers.get("location"), orderLocation);
assert.equal(
    (
        await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.submissionId, submissionId))
    ).length,
    1,
);

await request(`/api/cart/items/${inventory.id}/add`, {
    method: "POST",
    cookie: secondCookie,
    form: { quantity: "1" },
});
const crossVisitorRetry = await request("/api/orders", {
    method: "POST",
    cookie: secondCookie,
    form: { customerName: "Kid Two", submissionId },
});
assert.equal(crossVisitorRetry.status, 303);
assert.match(
    crossVisitorRetry.headers.get("location") ?? "",
    /^\/cart\?error=/,
);
assert.equal(
    (
        await db
            .select()
            .from(cartItemsTable)
            .where(eq(cartItemsTable.visitorId, visitorId(secondCookie)))
    )[0]?.quantity,
    1,
);

const firstHistory = await request("/orders", { cookie: firstCookie });
const firstHistoryHtml = await firstHistory.text();
assert.match(firstHistoryHtml, /Kid One/);
assert.equal(firstHistoryHtml.includes("Kid Two"), false);
const secondHistory = await request("/orders", { cookie: secondCookie });
assert.equal((await secondHistory.text()).includes("Kid One"), false);

await db.delete(inventoryTable).where(eq(inventoryTable.id, inventory.id));
assert.equal((await db.select().from(cartItemsTable)).length, 0);
