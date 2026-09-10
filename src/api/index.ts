import { Elysia } from "elysia";
import { images } from "./images";
import { inventory } from "./inventory";

export const api = new Elysia({ prefix: "api" }).use(images).use(inventory);
