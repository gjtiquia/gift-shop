import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
    createOrder,
    editOrder,
    fulfillOrder,
    getOrder,
    rejectOrder,
    restoreOrder,
} from "./service";
import { publicOrder } from "./index";
import { pages } from "../../pages";
import { db, inventoryTable, orderItemsTable, ordersTable } from "../../db";
import { AdminOrderPage } from "../../pages/AdminOrderPage";
import { AdminOrdersPage } from "../../pages/AdminOrdersPage";

async function reset() {
    await db.delete(orderItemsTable);
    await db.delete(ordersTable);
    await db.delete(inventoryTable);
}

async function addInventory(name: string, quantity: number) {
    const now = new Date();
    const [item] = await db
        .insert(inventoryTable)
        .values({
            name,
            priceCentsX10: 500,
            quantity,
            hidden: false,
            createdAt: now,
            lastModifiedAt: now,
        })
        .returning();
    return item;
}

await reset();
const oversubscribedItem = await addInventory("Gift", 3);
const first = await createOrder({
    customerName: "A",
    submissionId: crypto.randomUUID(),
    items: [{ inventoryId: oversubscribedItem.id, quantity: 3 }],
});
const second = await createOrder({
    customerName: "B",
    submissionId: crypto.randomUUID(),
    items: [{ inventoryId: oversubscribedItem.id, quantity: 3 }],
});
assert.equal(first.status, "success");
assert.equal(second.status, "success");
assert.equal((await db.select().from(inventoryTable).limit(1))[0]?.quantity, 3);

await reset();
const retryItem = await addInventory("Gift", 2);
const retryInput = {
    customerName: "Customer",
    submissionId: crypto.randomUUID(),
    items: [{ inventoryId: retryItem.id, quantity: 1 }],
};
const retryFirst = await createOrder(retryInput);
const retrySecond = await createOrder(retryInput);
assert.equal(retryFirst.status, "success");
assert.equal(retrySecond.status, "success");
if (retryFirst.status === "success" && retrySecond.status === "success") {
    assert.equal(retrySecond.order.id, retryFirst.order.id);
    assert.equal(retrySecond.created, false);
}
assert.equal((await db.select().from(ordersTable)).length, 1);

await reset();
const fulfilledItem = await addInventory("Gift", 5);
const fulfilled = await createOrder({
    customerName: "Customer",
    submissionId: crypto.randomUUID(),
    items: [{ inventoryId: fulfilledItem.id, quantity: 2 }],
});
assert.equal(fulfilled.status, "success");
if (fulfilled.status !== "success") throw new Error("order was not created");
assert.deepEqual(await fulfillOrder(fulfilled.order.id), { status: "success" });
assert.deepEqual(await fulfillOrder(fulfilled.order.id), {
    status: "invalid-transition",
});
assert.deepEqual(await rejectOrder(fulfilled.order.id), {
    status: "invalid-transition",
});
assert.equal((await db.select().from(inventoryTable).limit(1))[0]?.quantity, 3);
assert.equal((await getOrder(fulfilled.order.id))?.status, "fulfilled");

await reset();
const enough = await addInventory("Enough", 4);
const short = await addInventory("Short", 1);
const insufficient = await createOrder({
    customerName: "Customer",
    submissionId: crypto.randomUUID(),
    items: [
        { inventoryId: enough.id, quantity: 3 },
        { inventoryId: short.id, quantity: 1 },
    ],
});
if (insufficient.status !== "success") throw new Error("order was not created");
await db
    .update(inventoryTable)
    .set({ quantity: 0 })
    .where(eq(inventoryTable.id, short.id));
assert.equal(
    (await fulfillOrder(insufficient.order.id)).status,
    "insufficient-stock",
);
assert.equal(
    (
        await db
            .select()
            .from(inventoryTable)
            .where(eq(inventoryTable.id, enough.id))
    )[0]?.quantity,
    4,
);
assert.equal((await getOrder(insufficient.order.id))?.status, "unfulfilled");

await reset();
const rejectedItem = await addInventory("Gift", 2);
const rejected = await createOrder({
    customerName: "Customer",
    submissionId: crypto.randomUUID(),
    items: [{ inventoryId: rejectedItem.id, quantity: 1 }],
});
if (rejected.status !== "success") throw new Error("order was not created");
assert.deepEqual(await rejectOrder(rejected.order.id), { status: "success" });
assert.ok((await getOrder(rejected.order.id))?.rejectedAt instanceof Date);
assert.deepEqual(await fulfillOrder(rejected.order.id), {
    status: "invalid-transition",
});
assert.deepEqual(await restoreOrder(rejected.order.id), { status: "success" });
assert.equal((await getOrder(rejected.order.id))?.status, "unfulfilled");
assert.equal((await getOrder(rejected.order.id))?.rejectedAt, null);

await reset();
const kept = await addInventory("Kept", 5);
const deleted = await addInventory("Deleted", 2);
await db.delete(inventoryTable).where(eq(inventoryTable.id, deleted.id));
const editable = await createOrder({
    customerName: "Customer",
    submissionId: crypto.randomUUID(),
    items: [
        { inventoryId: kept.id, quantity: 2 },
        { inventoryId: deleted.id, quantity: 1 },
    ],
});
if (editable.status !== "success") throw new Error("order was not created");
assert.equal(
    editable.order.items.find((item) => item.inventoryId === deleted.id)
        ?.inventory,
    null,
);
assert.deepEqual(await fulfillOrder(editable.order.id), { status: "success" });
assert.deepEqual(
    await editOrder(editable.order.id, {
        customerName: "Changed",
        adminNotes: "Bargained separately",
        items: [
            {
                inventoryId: kept.id,
                quantity: 4,
                adminNotes: "Pack separately",
            },
        ],
    }),
    { status: "success" },
);
assert.equal(
    (
        await db
            .select()
            .from(inventoryTable)
            .where(eq(inventoryTable.id, kept.id))
    )[0]?.quantity,
    3,
);
const editedOrder = await getOrder(editable.order.id);
assert.equal(editedOrder?.customerName, "Changed");
assert.equal(editedOrder?.items[0]?.quantity, 4);
assert.equal(editedOrder?.items[0]?.adminNotes, "Pack separately");
assert.equal(
    (await db.select().from(orderItemsTable).limit(1))[0]?.adminNotes,
    "Pack separately",
);
if (!editedOrder) throw new Error("edited order was not found");
const customerOrder = publicOrder(editedOrder);
assert.equal("adminNotes" in customerOrder, false);
assert.equal("adminNotes" in customerOrder.items[0]!, false);
assert.equal(JSON.stringify(customerOrder).includes("Pack separately"), false);
assert.equal(
    JSON.stringify(customerOrder).includes("Bargained separately"),
    false,
);

const cartPageResponse = await pages.handle(
    new Request("http://localhost/cart"),
);
const cartPage = await cartPageResponse.text();
assert.match(cartPage, /Your cart is empty/);
assert.equal(cartPage.includes("giftShop.cart"), false);

const ordersPageResponse = await pages.handle(
    new Request("http://localhost/orders"),
);
const ordersPage = await ordersPageResponse.text();
assert.match(ordersPage, /No saved orders were found/);
assert.equal(ordersPage.includes("order-history-refresh"), false);

const customerOrderPageResponse = await pages.handle(
    new Request(`http://localhost/orders/${editable.order.id}`),
);
assert.equal(customerOrderPageResponse.status, 200);
const customerOrderPage = await customerOrderPageResponse.text();
assert.equal(customerOrderPage.includes("Pack separately"), false);
assert.equal(customerOrderPage.includes("Bargained separately"), false);
assert.equal(customerOrderPage.includes("text-white/80"), false);
assert.equal(customerOrderPage.includes("text-white"), true);
assert.match(
    customerOrderPage,
    /class="[^"]*bg-white[^"]*text-gray-950[^"]*" data-order-items-table/,
);

const adminOrderPage = String(
    AdminOrderPage({ order: editedOrder, inventory: [kept] }),
);
assert.match(adminOrderPage, /aria-label="Customer name"/);
assert.match(adminOrderPage, /aria-label="Private notes for Kept, item 1"/);
assert.match(adminOrderPage, /aria-label="Private order notes"/);
assert.equal(adminOrderPage.includes("text-white/80"), false);
assert.match(
    adminOrderPage,
    /class="[^"]*bg-white[^"]*text-gray-950[^"]*" data-order-items-table/,
);

const adminOrdersPage = String(AdminOrdersPage({ orders: [editedOrder] }));
const unfulfilledHeading = adminOrdersPage.indexOf("Unfulfilled orders");
const fulfilledHeading = adminOrdersPage.indexOf("Fulfilled orders");
const rejectedHeading = adminOrdersPage.indexOf("Rejected orders");
assert.ok(unfulfilledHeading >= 0);
assert.ok(fulfilledHeading > unfulfilledHeading);
assert.ok(rejectedHeading > fulfilledHeading);
assert.equal((adminOrdersPage.match(/<table/g) ?? []).length, 3);
assert.match(adminOrdersPage, /No unfulfilled orders/);
assert.match(adminOrdersPage, /No rejected orders/);
assert.match(adminOrdersPage, /bg-green-700 text-white/);

console.log("ORDER_SERVICE_TESTS_PASSED");
