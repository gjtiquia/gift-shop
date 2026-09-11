import { Elysia } from "elysia";
import { api } from "./api";
import { auth } from "./auth";
import { pages } from "./pages";

if (!process.env.VERSION) {
    process.env.VERSION = (
        await Bun.$`git rev-parse --short HEAD`.text()
    ).trim();
}

console.log("🦊 VERSION", process.env.VERSION);

const app = new Elysia()
    .use(pages)
    .use(auth)
    .use(api)
    .listen(process.env.PORT ?? 3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
