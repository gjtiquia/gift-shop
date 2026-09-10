import { Elysia } from "elysia";
import { inventoryApi } from "./api/inventory";
import { auth } from "./auth";
import { pages } from "./pages";

const app = new Elysia()
    .use(pages)
    .use(auth)
    .use(inventoryApi)
    .listen(process.env.PORT ?? 3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
