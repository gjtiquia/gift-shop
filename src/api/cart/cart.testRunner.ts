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
import { createAuthSession } from "../../auth/lucia";
import { authSessionCookieName } from "../../auth/sessionCookie";

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

for (const path of ["/", "/cart", "/orders"]) {
    const anonymousRead = await request(path);
    assert.equal(anonymousRead.status, 200);
    assert.equal(anonymousRead.headers.get("set-cookie"), null);
}
const obsoleteOrdersApi = await request("/api/orders");
assert.equal(obsoleteOrdersApi.status, 404);
assert.equal(obsoleteOrdersApi.headers.get("set-cookie"), null);
const invalidHome = await request("/", { cookie: "visitor_session=invalid" });
assert.equal(invalidHome.status, 200);
assert.equal(invalidHome.headers.get("set-cookie"), null);
assert.equal((await db.select().from(visitorSessionsTable)).length, 0);

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

const csrfRejected = await app.handle(
    new Request(`http://localhost/api/cart/items/${inventory.id}/add`, {
        method: "POST",
        headers: { "Sec-Fetch-Site": "cross-site" },
        body: new URLSearchParams({ quantity: "1" }),
    }),
);
assert.equal(csrfRejected.status, 403);
assert.equal((await db.select().from(visitorSessionsTable)).length, 0);

const addResponse = await request(`/api/cart/items/${inventory.id}/add`, {
    method: "POST",
    form: { quantity: "2" },
    htmx: true,
});
const addHtml = await addResponse.text();
assert.equal(addResponse.status, 200, addHtml);
assert.match(addHtml, /Added/);
assert.match(addHtml, /Cart \(2\)/);
assert.match(addHtml, /hx-swap-oob="outerHTML"/);
const firstCookie = cookieFrom(addResponse);
const firstSetCookie = addResponse.headers.get("set-cookie")!;
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
assert.equal((await db.select().from(cartItemsTable)).length, 1);

const [sessionBeforeRead] = await db
    .select()
    .from(visitorSessionsTable)
    .where(eq(visitorSessionsTable.id, visitorId(firstCookie)));
const renewedHome = await request("/", { cookie: firstCookie });
assert.equal(renewedHome.status, 200);
assert.match(
    renewedHome.headers.get("set-cookie") ?? "",
    new RegExp(`Max-Age=${visitorSessionCookieMaxAgeSeconds}`),
);
assert.equal(visitorId(cookieFrom(renewedHome)), visitorId(firstCookie));
const [sessionAfterRead] = await db
    .select()
    .from(visitorSessionsTable)
    .where(eq(visitorSessionsTable.id, visitorId(firstCookie)));
assert.equal(
    sessionAfterRead?.lastMutatedAt.getTime(),
    sessionBeforeRead?.lastMutatedAt.getTime(),
);

const secureMutation = await app.handle(
    new Request(`https://localhost/api/cart/items/${inventory.id}/add`, {
        method: "POST",
        headers: {
            "Sec-Fetch-Site": "same-origin",
            "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ quantity: "1" }),
    }),
);
assert.match(secureMutation.headers.get("set-cookie") ?? "", /Secure/);
const secureCookie = cookieFrom(secureMutation);
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

const emptyCheckoutMutation = await request("/api/orders", {
    method: "POST",
    form: { customerName: "Kid Two", submissionId: crypto.randomUUID() },
});
assert.equal(emptyCheckoutMutation.status, 303);
const secondCookie = cookieFrom(emptyCheckoutMutation);
assert.notEqual(visitorId(secondCookie), visitorId(firstCookie));
assert.equal((await db.select().from(visitorSessionsTable)).length, 2);

const otherCartPage = await request("/cart", { cookie: secondCookie });
assert.match(await otherCartPage.text(), /Your cart is empty/);
const firstCartPage = await request("/cart", { cookie: firstCookie });
const firstCartHtml = await firstCartPage.text();
assert.match(firstCartHtml, /Server cart gift/);
assert.match(firstCartHtml, /id="cart-region"/);
assert.match(firstCartHtml, /name="submissionId"/);
assert.match(firstCartHtml, /hx-target="#cart-region"/);
assert.match(firstCartHtml, /#cart-region:queue all/);
assert.match(firstCartHtml, /hx-post="\/api\/orders"/);
assert.match(firstCartHtml, /data-loading-region/);
assert.match(firstCartHtml, /Submitting order/);

await db
    .update(visitorSessionsTable)
    .set({ lastMutatedAt: new Date(0) })
    .where(eq(visitorSessionsTable.id, visitorId(firstCookie)));
const increaseResponse = await request(
    `/api/cart/items/${inventory.id}/increase`,
    { method: "POST", cookie: firstCookie, htmx: true },
);
assert.equal(increaseResponse.status, 200);
const [sessionAfterMutation] = await db
    .select()
    .from(visitorSessionsTable)
    .where(eq(visitorSessionsTable.id, visitorId(firstCookie)));
assert.ok((sessionAfterMutation?.lastMutatedAt.getTime() ?? 0) > 0);
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
const failedHtmxCheckout = await request("/api/orders", {
    method: "POST",
    cookie: firstCookie,
    form: { customerName: "Kid One", submissionId: crypto.randomUUID() },
    htmx: true,
});
assert.equal(failedHtmxCheckout.status, 422);
assert.equal(failedHtmxCheckout.headers.get("HX-Retarget"), "#cart-error");
assert.equal(failedHtmxCheckout.headers.get("HX-Reswap"), "textContent");
assert.match(await failedHtmxCheckout.text(), /only 2 available/);
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

await db
    .update(visitorSessionsTable)
    .set({ lastMutatedAt: new Date(0) })
    .where(eq(visitorSessionsTable.id, visitorId(firstCookie)));
const submissionId = crypto.randomUUID();
const checkout = await request("/api/orders", {
    method: "POST",
    cookie: firstCookie,
    form: { customerName: "Kid One", submissionId },
});
assert.equal(checkout.status, 303);
const [sessionAfterCheckout] = await db
    .select()
    .from(visitorSessionsTable)
    .where(eq(visitorSessionsTable.id, visitorId(firstCookie)));
assert.ok((sessionAfterCheckout?.lastMutatedAt.getTime() ?? 0) > 0);
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

const secondSubmissionId = crypto.randomUUID();
const htmxCheckout = await request("/api/orders", {
    method: "POST",
    cookie: secondCookie,
    form: { customerName: "Kid Two", submissionId: secondSubmissionId },
    htmx: true,
});
assert.equal(htmxCheckout.status, 200);
assert.match(
    htmxCheckout.headers.get("HX-Redirect") ?? "",
    /^\/orders\/[0-9a-f-]{36}$/i,
);
assert.equal(
    (
        await db
            .select()
            .from(cartItemsTable)
            .where(eq(cartItemsTable.visitorId, visitorId(secondCookie)))
    ).length,
    0,
);

const firstHistory = await request("/orders", { cookie: firstCookie });
const firstHistoryHtml = await firstHistory.text();
assert.match(firstHistoryHtml, /Kid One/);
assert.equal(firstHistoryHtml.includes("Kid Two"), false);
const secondHistory = await request("/orders", { cookie: secondCookie });
assert.equal((await secondHistory.text()).includes("Kid One"), false);

assert.ok(orderLocation);
const ownerOrderPage = await request(orderLocation, { cookie: firstCookie });
assert.equal(ownerOrderPage.status, 200);
assert.match(await ownerOrderPage.text(), /Kid One/);
const obsoleteOrderApi = await request(`/api${orderLocation}`, {
    cookie: firstCookie,
});
assert.equal(obsoleteOrderApi.status, 404);

const visitorCountBeforeAnonymousOrderRead = (
    await db.select().from(visitorSessionsTable)
).length;
const missingVisitor = await request(orderLocation);
assert.equal(missingVisitor.status, 404);
assert.equal(missingVisitor.headers.get("set-cookie"), null);
const wrongVisitor = await request(orderLocation, { cookie: secondCookie });
assert.equal(wrongVisitor.status, 404);
assert.equal(
    (await db.select().from(visitorSessionsTable)).length,
    visitorCountBeforeAnonymousOrderRead,
);

const { authSessionToken } = await createAuthSession("admin");
const adminOrderPage = await request(`/admin${orderLocation}`, {
    cookie: `${authSessionCookieName}=${authSessionToken}`,
});
assert.equal(adminOrderPage.status, 200);
assert.match(await adminOrderPage.text(), /Kid One/);

assert.throws(() =>
    db
        .delete(visitorSessionsTable)
        .where(eq(visitorSessionsTable.id, visitorId(firstCookie)))
        .run(),
);
assert.equal(
    (
        await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, createdOrder.id))
    ).length,
    1,
);

await db.delete(inventoryTable).where(eq(inventoryTable.id, inventory.id));
assert.equal((await db.select().from(cartItemsTable)).length, 0);
