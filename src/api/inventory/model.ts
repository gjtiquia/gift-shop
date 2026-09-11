import { t, type Static } from "elysia";

export const inventoryFormSchema = t.Object({
    name: t.Optional(t.String()),
    price: t.Optional(t.String()),
    quantity: t.Optional(t.String()),
    hidden: t.Optional(t.String()),
    adminNotes: t.Optional(t.String()),
    image: t.Optional(t.File()),
});

export type InventoryForm = Static<typeof inventoryFormSchema>;
