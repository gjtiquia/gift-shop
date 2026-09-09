import { Elysia } from "elysia";
import { db, inventoryTable } from "./db";

const app = new Elysia()
    .get("/api/catalogue", async () => {
        const catalogue = await db
            .select({
                name: inventoryTable.name,
                price: inventoryTable.priceCentsX10,
            })
            .from(inventoryTable);

        return catalogue;
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
