import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cartItemsTable, db, inventoryTable } from "../../db";

export interface CartItemView {
    inventoryId: number;
    quantity: number;
    inventory: {
        name: string;
        priceCentsX10: number;
        quantity: number;
        imageId: number | null;
    };
}

export type CartMutationResult =
    { status: "success" } | { status: "invalid"; message: string };

export async function getCartItems(visitorId: string): Promise<CartItemView[]> {
    const cartItems = await db
        .select({
            inventoryId: cartItemsTable.inventoryId,
            quantity: cartItemsTable.quantity,
        })
        .from(cartItemsTable)
        .where(eq(cartItemsTable.visitorId, visitorId))
        .orderBy(asc(cartItemsTable.id));
    if (cartItems.length === 0) return [];

    const inventory = await db
        .select({
            id: inventoryTable.id,
            name: inventoryTable.name,
            priceCentsX10: inventoryTable.priceCentsX10,
            quantity: inventoryTable.quantity,
            imageId: inventoryTable.imageId,
        })
        .from(inventoryTable)
        .where(
            inArray(
                inventoryTable.id,
                cartItems.map((item) => item.inventoryId),
            ),
        );
    const inventoryById = new Map(inventory.map((item) => [item.id, item]));

    return cartItems.flatMap((item) => {
        const current = inventoryById.get(item.inventoryId);
        return current ? [{ ...item, inventory: current }] : [];
    });
}

export async function countCartUnits(visitorId: string) {
    const [result] = await db
        .select({
            count: sql<number>`coalesce(sum(${cartItemsTable.quantity}), 0)`,
        })
        .from(cartItemsTable)
        .where(eq(cartItemsTable.visitorId, visitorId));
    return Number(result?.count ?? 0);
}

export async function addCartItem(
    visitorId: string,
    inventoryId: number,
    quantity: number,
): Promise<CartMutationResult> {
    if (!validInventoryId(inventoryId) || !validQuantity(quantity)) {
        return invalidCart();
    }

    return db.transaction((transaction) => {
        const inventory = transaction
            .select({
                name: inventoryTable.name,
                quantity: inventoryTable.quantity,
                hidden: inventoryTable.hidden,
            })
            .from(inventoryTable)
            .where(eq(inventoryTable.id, inventoryId))
            .get();
        if (!inventory || inventory.hidden) return invalidCart();

        const existing = transaction
            .select({ quantity: cartItemsTable.quantity })
            .from(cartItemsTable)
            .where(
                and(
                    eq(cartItemsTable.visitorId, visitorId),
                    eq(cartItemsTable.inventoryId, inventoryId),
                ),
            )
            .get();
        const nextQuantity = (existing?.quantity ?? 0) + quantity;
        if (nextQuantity > inventory.quantity) {
            return invalidCart(
                `${inventory.name} has only ${inventory.quantity} available.`,
            );
        }

        const now = new Date();
        if (existing) {
            transaction
                .update(cartItemsTable)
                .set({ quantity: nextQuantity, lastModifiedAt: now })
                .where(
                    and(
                        eq(cartItemsTable.visitorId, visitorId),
                        eq(cartItemsTable.inventoryId, inventoryId),
                    ),
                )
                .run();
        } else {
            transaction
                .insert(cartItemsTable)
                .values({
                    visitorId,
                    inventoryId,
                    quantity,
                    createdAt: now,
                    lastModifiedAt: now,
                })
                .run();
        }
        return { status: "success" as const };
    });
}

export async function setCartItemQuantity(
    visitorId: string,
    inventoryId: number,
    quantity: number,
): Promise<CartMutationResult> {
    if (!validInventoryId(inventoryId) || !validQuantity(quantity)) {
        return invalidCart();
    }

    return db.transaction((transaction) => {
        const inventory = transaction
            .select({
                name: inventoryTable.name,
                quantity: inventoryTable.quantity,
            })
            .from(inventoryTable)
            .where(eq(inventoryTable.id, inventoryId))
            .get();
        if (!inventory) return invalidCart("Inventory item not found.");
        if (quantity > inventory.quantity) {
            return invalidCart(
                `${inventory.name} has only ${inventory.quantity} available.`,
            );
        }

        const changed = transaction
            .update(cartItemsTable)
            .set({ quantity, lastModifiedAt: new Date() })
            .where(
                and(
                    eq(cartItemsTable.visitorId, visitorId),
                    eq(cartItemsTable.inventoryId, inventoryId),
                ),
            )
            .returning({ id: cartItemsTable.id })
            .get();
        return changed
            ? { status: "success" as const }
            : invalidCart("Cart item not found.");
    });
}

export async function adjustCartItemQuantity(
    visitorId: string,
    inventoryId: number,
    change: -1 | 1,
): Promise<CartMutationResult> {
    if (!validInventoryId(inventoryId)) return invalidCart();

    return db.transaction((transaction) => {
        const item = transaction
            .select({
                quantity: cartItemsTable.quantity,
                available: inventoryTable.quantity,
                name: inventoryTable.name,
            })
            .from(cartItemsTable)
            .innerJoin(
                inventoryTable,
                eq(cartItemsTable.inventoryId, inventoryTable.id),
            )
            .where(
                and(
                    eq(cartItemsTable.visitorId, visitorId),
                    eq(cartItemsTable.inventoryId, inventoryId),
                ),
            )
            .get();
        if (!item) return invalidCart("Cart item not found.");

        const quantity = item.quantity + change;
        if (quantity < 1) return invalidCart();
        if (quantity > item.available) {
            return invalidCart(
                `${item.name} has only ${item.available} available.`,
            );
        }

        transaction
            .update(cartItemsTable)
            .set({ quantity, lastModifiedAt: new Date() })
            .where(
                and(
                    eq(cartItemsTable.visitorId, visitorId),
                    eq(cartItemsTable.inventoryId, inventoryId),
                ),
            )
            .run();
        return { status: "success" as const };
    });
}

export async function removeCartItem(visitorId: string, inventoryId: number) {
    if (!validInventoryId(inventoryId)) return invalidCart();
    await db
        .delete(cartItemsTable)
        .where(
            and(
                eq(cartItemsTable.visitorId, visitorId),
                eq(cartItemsTable.inventoryId, inventoryId),
            ),
        );
    return { status: "success" as const };
}

function validInventoryId(value: number) {
    return Number.isSafeInteger(value) && value > 0;
}

function validQuantity(value: number) {
    return Number.isSafeInteger(value) && value > 0;
}

function invalidCart(message = "Enter a valid cart quantity.") {
    return { status: "invalid" as const, message };
}
