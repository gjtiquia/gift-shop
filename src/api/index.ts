import { Elysia } from "elysia";
import { inventory } from "./inventory";

export const api = new Elysia({ prefix: "api" }).use(inventory);
