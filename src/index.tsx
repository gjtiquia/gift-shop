import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
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
    .use(html())
    .get("/", () => (
        <html lang="en">
            <head>
                <title>Hello World </title>
            </head>
            <body>
                <h1>Hello World </h1>
            </body>
        </html>
    ))
    .listen(process.env.PORT ?? 3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
