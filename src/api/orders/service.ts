import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
    cartItemsTable,
    db,
    inventoryTable,
    orderItemsTable,
    ordersTable,
    type OrderStatus,
} from "../../db";

export interface SubmittedOrderItem {
    inventoryId: number;
    quantity: number;
    adminNotes?: string;
}

export interface OrderItemView {
    inventoryId: number;
    quantity: number;
    adminNotes: string | null;
    inventory: {
        name: string;
        priceCentsX10: number;
        quantity: number;
        hidden: boolean;
        imageId: number | null;
    } | null;
}

export interface OrderView {
    id: string;
    visitorId: string | null;
    customerName: string;
    status: OrderStatus;
    adminNotes: string | null;
    createdAt: Date;
    lastModifiedAt: Date;
    fulfilledAt: Date | null;
    rejectedAt: Date | null;
    items: OrderItemView[];
}

export type CreateOrderResult =
    | { status: "success"; order: OrderView; created: boolean }
    | { status: "invalid"; message: string };

export type FulfillOrderResult =
    | { status: "success" }
    | { status: "not-found" | "invalid-transition" }
    | {
          status: "insufficient-stock";
          shortages: Array<{
              inventoryId: number;
              name: string;
              requested: number;
              available: number;
          }>;
      };

export async function createOrder(input: {
    customerName: string;
    submissionId: string;
    items: SubmittedOrderItem[];
    visitorId?: string;
}): Promise<CreateOrderResult> {
    const customerName = input.customerName.trim();
    const items = normalizeItems(input.items);
    if (
        !customerName ||
        customerName.length > 200 ||
        !isSubmissionId(input.submissionId) ||
        !items
    ) {
        return {
            status: "invalid",
            message: "Enter a name and valid cart quantities.",
        };
    }

    const [existing] = await db
        .select({ id: ordersTable.id, visitorId: ordersTable.visitorId })
        .from(ordersTable)
        .where(eq(ordersTable.submissionId, input.submissionId))
        .limit(1);
    if (existing) {
        if (existing.visitorId !== (input.visitorId ?? null)) {
            return { status: "invalid", message: "Invalid submission." };
        }
        const order = await getOrder(existing.id);
        if (order) return { status: "success", order, created: false };
    }

    const inventory = await db
        .select({
            id: inventoryTable.id,
            name: inventoryTable.name,
            quantity: inventoryTable.quantity,
        })
        .from(inventoryTable)
        .where(
            inArray(
                inventoryTable.id,
                items.map((item) => item.inventoryId),
            ),
        );
    const inventoryById = new Map(inventory.map((item) => [item.id, item]));
    for (const item of items) {
        const current = inventoryById.get(item.inventoryId);
        if (!current) continue;
        if (item.quantity > current.quantity) {
            return {
                status: "invalid",
                message: `${current.name} has only ${current.quantity} available.`,
            };
        }
    }

    const now = new Date();
    const id = crypto.randomUUID();
    try {
        db.transaction((transaction) => {
            transaction
                .insert(ordersTable)
                .values({
                    id,
                    submissionId: input.submissionId,
                    visitorId: input.visitorId,
                    customerName,
                    status: "unfulfilled",
                    createdAt: now,
                    lastModifiedAt: now,
                })
                .run();
            transaction
                .insert(orderItemsTable)
                .values(
                    items.map((item) => ({
                        orderId: id,
                        inventoryId: item.inventoryId,
                        quantity: item.quantity,
                        adminNotes: item.adminNotes || null,
                        createdAt: now,
                        lastModifiedAt: now,
                    })),
                )
                .run();
        });
    } catch (error) {
        // A repeated idempotency key can race in another request.
        const [racedOrder] = await db
            .select({ id: ordersTable.id, visitorId: ordersTable.visitorId })
            .from(ordersTable)
            .where(eq(ordersTable.submissionId, input.submissionId))
            .limit(1);
        if (!racedOrder || racedOrder.visitorId !== (input.visitorId ?? null)) {
            throw error;
        }
        const order = await getOrder(racedOrder.id);
        if (!order) throw error;
        return { status: "success", order, created: false };
    }

    const order = await getOrder(id);
    if (!order) throw new Error("Created order could not be loaded.");
    return { status: "success", order, created: true };
}

export async function checkoutCart(
    visitorId: string,
    input: { customerName: string; submissionId: string },
): Promise<CreateOrderResult> {
    const customerName = input.customerName.trim();
    if (
        !customerName ||
        customerName.length > 200 ||
        !isSubmissionId(input.submissionId)
    ) {
        return {
            status: "invalid",
            message: "Enter a name and valid cart quantities.",
        };
    }

    let result:
        | { status: "success"; id: string; created: boolean }
        | { status: "invalid"; message: string };
    try {
        result = db.transaction((transaction) => {
            const existing = transaction
                .select({
                    id: ordersTable.id,
                    visitorId: ordersTable.visitorId,
                })
                .from(ordersTable)
                .where(eq(ordersTable.submissionId, input.submissionId))
                .get();
            if (existing) {
                return existing.visitorId === visitorId
                    ? {
                          status: "success" as const,
                          id: existing.id,
                          created: false,
                      }
                    : {
                          status: "invalid" as const,
                          message: "Invalid submission.",
                      };
            }

            const items = transaction
                .select({
                    inventoryId: cartItemsTable.inventoryId,
                    quantity: cartItemsTable.quantity,
                    available: inventoryTable.quantity,
                    name: inventoryTable.name,
                })
                .from(cartItemsTable)
                .innerJoin(
                    inventoryTable,
                    eq(cartItemsTable.inventoryId, inventoryTable.id),
                )
                .where(eq(cartItemsTable.visitorId, visitorId))
                .all();
            if (items.length === 0) {
                return {
                    status: "invalid" as const,
                    message: "Your cart is empty.",
                };
            }
            for (const item of items) {
                if (item.quantity > item.available) {
                    return {
                        status: "invalid" as const,
                        message: `${item.name} has only ${item.available} available.`,
                    };
                }
            }

            const now = new Date();
            const id = crypto.randomUUID();
            transaction
                .insert(ordersTable)
                .values({
                    id,
                    submissionId: input.submissionId,
                    visitorId,
                    customerName,
                    status: "unfulfilled",
                    createdAt: now,
                    lastModifiedAt: now,
                })
                .run();
            transaction
                .insert(orderItemsTable)
                .values(
                    items.map((item) => ({
                        orderId: id,
                        inventoryId: item.inventoryId,
                        quantity: item.quantity,
                        createdAt: now,
                        lastModifiedAt: now,
                    })),
                )
                .run();
            transaction
                .delete(cartItemsTable)
                .where(eq(cartItemsTable.visitorId, visitorId))
                .run();
            return { status: "success" as const, id, created: true };
        });
    } catch (error) {
        const [existing] = await db
            .select({ id: ordersTable.id, visitorId: ordersTable.visitorId })
            .from(ordersTable)
            .where(eq(ordersTable.submissionId, input.submissionId))
            .limit(1);
        if (!existing || existing.visitorId !== visitorId) throw error;
        result = { status: "success", id: existing.id, created: false };
    }

    if (result.status === "invalid") return result;
    const order = await getOrder(result.id);
    if (!order) throw new Error("Created order could not be loaded.");
    return { status: "success", order, created: result.created };
}

export async function getOrder(id: string): Promise<OrderView | null> {
    const orders = await loadOrders(eq(ordersTable.id, id));
    return orders[0] ?? null;
}

export async function getOrders(ids: string[]): Promise<OrderView[]> {
    const validIds = Array.from(new Set(ids.filter(isOrderId))).slice(0, 100);
    if (validIds.length === 0) return [];
    const orders = await loadOrders(inArray(ordersTable.id, validIds));
    const position = new Map(validIds.map((id, index) => [id, index]));
    return orders.sort(
        (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
    );
}

export async function getVisitorOrders(visitorId: string) {
    return loadOrders(eq(ordersTable.visitorId, visitorId));
}

export async function getAdminOrders(): Promise<OrderView[]> {
    return loadOrders(undefined, true);
}

export async function countUnfulfilledOrders() {
    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ordersTable)
        .where(eq(ordersTable.status, "unfulfilled"));
    return Number(result?.count ?? 0);
}

export async function editOrder(
    id: string,
    input: {
        customerName: string;
        adminNotes?: string;
        items: SubmittedOrderItem[];
    },
) {
    const customerName = input.customerName.trim();
    const adminNotes = input.adminNotes?.trim();
    const items = normalizeItems(input.items);
    if (
        !customerName ||
        customerName.length > 200 ||
        (adminNotes?.length ?? 0) > 2_000 ||
        !items
    ) {
        return { status: "invalid" as const };
    }

    const now = new Date();
    return db.transaction((transaction) => {
        const [updated] = transaction
            .update(ordersTable)
            .set({
                customerName,
                adminNotes: adminNotes || null,
                lastModifiedAt: now,
            })
            .where(eq(ordersTable.id, id))
            .returning({ id: ordersTable.id })
            .all();
        if (!updated) return { status: "not-found" as const };

        transaction
            .delete(orderItemsTable)
            .where(eq(orderItemsTable.orderId, id))
            .run();
        transaction
            .insert(orderItemsTable)
            .values(
                items.map((item) => ({
                    orderId: id,
                    inventoryId: item.inventoryId,
                    quantity: item.quantity,
                    adminNotes: item.adminNotes || null,
                    createdAt: now,
                    lastModifiedAt: now,
                })),
            )
            .run();
        return { status: "success" as const };
    });
}

export async function fulfillOrder(id: string): Promise<FulfillOrderResult> {
    const now = new Date();
    return db.transaction((transaction) => {
        const [order] = transaction
            .select({ status: ordersTable.status })
            .from(ordersTable)
            .where(eq(ordersTable.id, id))
            .limit(1)
            .all();
        if (!order) return { status: "not-found" as const };
        if (order.status !== "unfulfilled") {
            return { status: "invalid-transition" as const };
        }

        const items = transaction
            .select({
                inventoryId: orderItemsTable.inventoryId,
                quantity: sql<number>`sum(${orderItemsTable.quantity})`,
            })
            .from(orderItemsTable)
            .where(eq(orderItemsTable.orderId, id))
            .groupBy(orderItemsTable.inventoryId)
            .all();
        const shortages: Extract<
            FulfillOrderResult,
            { status: "insufficient-stock" }
        >["shortages"] = [];
        const existingItems: Array<{ inventoryId: number; quantity: number }> =
            [];

        for (const item of items) {
            const [inventory] = transaction
                .select({
                    id: inventoryTable.id,
                    name: inventoryTable.name,
                    quantity: inventoryTable.quantity,
                })
                .from(inventoryTable)
                .where(eq(inventoryTable.id, item.inventoryId))
                .limit(1)
                .all();
            if (!inventory) continue;
            const quantity = Number(item.quantity);
            if (inventory.quantity < quantity) {
                shortages.push({
                    inventoryId: inventory.id,
                    name: inventory.name,
                    requested: quantity,
                    available: inventory.quantity,
                });
            } else {
                existingItems.push({ inventoryId: inventory.id, quantity });
            }
        }

        if (shortages.length > 0) {
            return { status: "insufficient-stock" as const, shortages };
        }

        const [updated] = transaction
            .update(ordersTable)
            .set({
                status: "fulfilled",
                fulfilledAt: now,
                rejectedAt: null,
                lastModifiedAt: now,
            })
            .where(
                and(
                    eq(ordersTable.id, id),
                    eq(ordersTable.status, "unfulfilled"),
                ),
            )
            .returning({ id: ordersTable.id })
            .all();
        if (!updated) return { status: "invalid-transition" as const };
        for (const item of existingItems) {
            transaction
                .update(inventoryTable)
                .set({
                    quantity: sql`${inventoryTable.quantity} - ${item.quantity}`,
                    lastModifiedAt: now,
                })
                .where(eq(inventoryTable.id, item.inventoryId))
                .run();
        }
        return { status: "success" as const };
    });
}

export async function rejectOrder(id: string) {
    return transitionOrder(id, "unfulfilled", "rejected");
}

export async function restoreOrder(id: string) {
    return transitionOrder(id, "rejected", "unfulfilled");
}

async function transitionOrder(id: string, from: OrderStatus, to: OrderStatus) {
    const now = new Date();
    const [existing] = await db
        .select({ id: ordersTable.id, status: ordersTable.status })
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);
    if (!existing) return { status: "not-found" as const };

    const [updated] = await db
        .update(ordersTable)
        .set({
            status: to,
            fulfilledAt: to === "fulfilled" ? now : null,
            rejectedAt: to === "rejected" ? now : null,
            lastModifiedAt: now,
        })
        .where(and(eq(ordersTable.id, id), eq(ordersTable.status, from)))
        .returning({ id: ordersTable.id });
    return updated
        ? { status: "success" as const }
        : { status: "invalid-transition" as const };
}

function normalizeItems(items: SubmittedOrderItem[]) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
        return null;
    }
    const normalized = new Map<
        number,
        { inventoryId: number; quantity: number; adminNotes?: string }
    >();
    for (const item of items) {
        const adminNotes = item.adminNotes?.trim();
        if (
            !Number.isSafeInteger(item.inventoryId) ||
            item.inventoryId <= 0 ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0 ||
            (adminNotes?.length ?? 0) > 2_000
        ) {
            return null;
        }
        const existing = normalized.get(item.inventoryId);
        const quantity = (existing?.quantity ?? 0) + item.quantity;
        if (!Number.isSafeInteger(quantity)) return null;
        normalized.set(item.inventoryId, {
            inventoryId: item.inventoryId,
            quantity,
            adminNotes:
                [existing?.adminNotes, adminNotes].filter(Boolean).join("\n") ||
                undefined,
        });
    }
    return Array.from(normalized.values());
}

function isSubmissionId(value: string) {
    return /^[0-9a-f-]{36}$/i.test(value);
}

export function isOrderId(value: string) {
    return /^[0-9a-f-]{36}$/i.test(value);
}

async function loadOrders(
    where?: ReturnType<typeof eq> | ReturnType<typeof inArray>,
    adminOrder = false,
): Promise<OrderView[]> {
    let query = db
        .select({
            id: ordersTable.id,
            visitorId: ordersTable.visitorId,
            customerName: ordersTable.customerName,
            status: ordersTable.status,
            adminNotes: ordersTable.adminNotes,
            createdAt: ordersTable.createdAt,
            lastModifiedAt: ordersTable.lastModifiedAt,
            fulfilledAt: ordersTable.fulfilledAt,
            rejectedAt: ordersTable.rejectedAt,
            orderItemId: orderItemsTable.id,
            inventoryId: orderItemsTable.inventoryId,
            orderedQuantity: orderItemsTable.quantity,
            orderItemAdminNotes: orderItemsTable.adminNotes,
            inventoryName: inventoryTable.name,
            priceCentsX10: inventoryTable.priceCentsX10,
            inventoryQuantity: inventoryTable.quantity,
            inventoryHidden: inventoryTable.hidden,
            inventoryImageId: inventoryTable.imageId,
        })
        .from(ordersTable)
        .leftJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
        .leftJoin(
            inventoryTable,
            eq(inventoryTable.id, orderItemsTable.inventoryId),
        )
        .$dynamic();
    if (where) query = query.where(where);
    if (adminOrder) {
        query = query.orderBy(
            sql`case when ${ordersTable.status} = 'unfulfilled' then 0 else 1 end`,
            desc(ordersTable.createdAt),
            orderItemsTable.id,
        );
    } else {
        query = query.orderBy(desc(ordersTable.createdAt), orderItemsTable.id);
    }

    const rows = await query;
    const byId = new Map<string, OrderView>();
    for (const row of rows) {
        let order = byId.get(row.id);
        if (!order) {
            order = {
                id: row.id,
                visitorId: row.visitorId,
                customerName: row.customerName,
                status: row.status,
                adminNotes: row.adminNotes,
                createdAt: row.createdAt,
                lastModifiedAt: row.lastModifiedAt,
                fulfilledAt: row.fulfilledAt,
                rejectedAt: row.rejectedAt,
                items: [],
            };
            byId.set(row.id, order);
        }
        if (
            row.orderItemId !== null &&
            row.inventoryId !== null &&
            row.orderedQuantity !== null
        ) {
            order.items.push({
                inventoryId: row.inventoryId,
                quantity: row.orderedQuantity,
                adminNotes: row.orderItemAdminNotes,
                inventory:
                    row.inventoryName === null ||
                    row.priceCentsX10 === null ||
                    row.inventoryQuantity === null ||
                    row.inventoryHidden === null
                        ? null
                        : {
                              name: row.inventoryName,
                              priceCentsX10: row.priceCentsX10,
                              quantity: row.inventoryQuantity,
                              hidden: row.inventoryHidden,
                              imageId: row.inventoryImageId,
                          },
            });
        }
    }
    return Array.from(byId.values());
}
