import {
    blob,
    int,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ref: https://github.com/lucia-auth/lucia/blob/main/code/auth_session.ts
// we omit the userId cuz we dont have the notion of "users" to keep things simple
export const authSessionsTable = sqliteTable("auth_sessions_table", {
    id: text().primaryKey(),
    secretHash: blob({ mode: "buffer" }).notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastVerifiedAt: int({ mode: "timestamp_ms" }).notNull(),
});

// Visitor sessions intentionally have no server-side expiration.
export const visitorSessionsTable = sqliteTable("visitor_sessions_table", {
    id: text().primaryKey(),
    secretHash: blob({ mode: "buffer" }).notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastMutatedAt: int({ mode: "timestamp_ms" }).notNull(),
});

export const inventoryTable = sqliteTable("inventory_table", {
    // required
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    priceCentsX10: int().notNull(), // eg. 9.99 is stored as 999
    quantity: int().notNull(),
    hidden: int({ mode: "boolean" }).notNull().default(false),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),

    // optional
    imageId: int().references(() => imagesTable.id),
    adminNotes: text(),
});

export const cartItemsTable = sqliteTable(
    "cart_items_table",
    {
        id: int().primaryKey({ autoIncrement: true }),
        visitorId: text()
            .references(() => visitorSessionsTable.id, { onDelete: "cascade" })
            .notNull(),
        inventoryId: int()
            .references(() => inventoryTable.id, { onDelete: "cascade" })
            .notNull(),
        quantity: int().notNull(),
        createdAt: int({ mode: "timestamp_ms" }).notNull(),
        lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        uniqueIndex("cart_items_visitor_inventory_unique").on(
            table.visitorId,
            table.inventoryId,
        ),
    ],
);

export const orderStatuses = ["unfulfilled", "fulfilled", "rejected"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const ordersTable = sqliteTable("orders_table", {
    // Random IDs make customer order URLs impractical to enumerate.
    id: text().primaryKey(),
    submissionId: text().notNull().unique(),
    // Orders retain ownership, so referenced visitor sessions cannot be deleted.
    visitorId: text().references(() => visitorSessionsTable.id, {
        onDelete: "restrict",
    }),
    customerName: text().notNull(), // we keep things simple, no users_table, no auth, no login
    status: text({ enum: orderStatuses }).notNull().default("unfulfilled"),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),

    adminNotes: text(),
    fulfilledAt: int({ mode: "timestamp_ms" }),
    rejectedAt: int({ mode: "timestamp_ms" }),
});

export const orderItemsTable = sqliteTable("order_items_table", {
    id: int().primaryKey({ autoIncrement: true }),
    orderId: text()
        .references(() => ordersTable.id, { onDelete: "cascade" })
        .notNull(),
    // Orders use live catalogue data rather than snapshots. This is not a
    // foreign key so deleted inventory leaves the numeric order reference.
    inventoryId: int().notNull(),
    quantity: int().notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),

    // optional
    adminNotes: text(),
});

export const imagesTable = sqliteTable("images_table", {
    id: int().primaryKey({ autoIncrement: true }),
    filename: text().notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),
});
