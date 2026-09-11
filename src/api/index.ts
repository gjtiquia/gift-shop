import { Elysia } from "elysia";
import { images } from "./images";
import { inventory } from "./inventory";
import { orders } from "./orders";

export const api = new Elysia({ prefix: "api" })
    .use(images)
    .use(inventory)
    .use(orders);
