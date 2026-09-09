import { boolean } from "drizzle-orm/cockroach-core/columns/bool";
import { blob, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ref: https://github.com/lucia-auth/lucia/blob/main/code/auth_session.ts
// we omit the userId cuz we dont have the notion of "users" to keep things simple
export const authSessionsTable = sqliteTable("auth_sessions_table", {
    id: text().primaryKey(),
    secretHash: blob().notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastVerifiedAt: int({ mode: "timestamp_ms" }).notNull(),
});

export const inventoryTable = sqliteTable("inventory_table", {
    // required
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    priceCentsX10: int().notNull(), // eg. 9.99 is stored as 999
    quantity: int().notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),

    // optional
    imageId: int().references(() => imagesTable.id),
    adminNotes: text(),
});

export const ordersTable = sqliteTable("orders_table", {
    // required
    id: int().primaryKey({ autoIncrement: true }),
    customerName: text().notNull(), // we keep things simple, no users_table, no auth, no login
    fulfilled: int({ mode: "boolean" }).notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),

    // optional
    adminNotes: text(),
});

export const orderItemsTable = sqliteTable("order_items_table", {
    // required
    id: int().primaryKey({ autoIncrement: true }),
    inventoryId: int()
        .references(() => inventoryTable.id)
        .notNull(),
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
