import { Elysia } from "elysia";
import { db, usersTable } from "./db";

const app = new Elysia()
    .get("/", async () => {
        const users = await db.select().from(usersTable);
        return users;
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
