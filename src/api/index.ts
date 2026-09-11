import { Elysia } from "elysia";
import { cart } from "./cart";
import { images } from "./images";
import { inventory } from "./inventory";
import { orders } from "./orders";

export const api = new Elysia({ prefix: "api" })
    .use(cart)
    .use(images)
    .use(inventory)
    .use(orders);
