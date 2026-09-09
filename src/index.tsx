import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
import { db, inventoryTable } from "./db";
import { pages } from "./pages";
import { auth } from "./auth";

const app = new Elysia()
    .use(pages)
    .use(auth)
    .listen(process.env.PORT ?? 3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
