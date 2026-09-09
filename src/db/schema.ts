import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryTable = sqliteTable("inventory_table", {
    // required
    id: int().primaryKey({ autoIncrement: true }),
    price: int().notNull(),
    quantity: int().notNull(),
    createdAt: int({ mode: "timestamp_ms" }).notNull(),
    lastModifiedAt: int({ mode: "timestamp_ms" }).notNull(),
    name: text().notNull(),

    // optional
    imageId: int().references(() => imagesTable.id),
});

export const imagesTable = sqliteTable("images_table", {
    id: int().primaryKey({ autoIncrement: true }),
    filename: text().notNull(),
    createdAt: int({ mode: "timestamp_ms" }),
    lastModifiedAt: int({ mode: "timestamp_ms" }),
});
