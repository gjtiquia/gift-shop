import { Elysia } from "elysia";
import { db, inventoryTable } from "./db";

const app = new Elysia()
    .get("/api/catalogue", async () => {
        const catalogue = await db
            .select({
                name: inventoryTable.name,
                priceCentsX10: inventoryTable.priceCentsX10,
            })
            .from(inventoryTable);

        return catalogue;
    })
    .listen(process.env.PORT ?? 3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
