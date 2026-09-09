import { Elysia } from "elysia";
import { HomePage } from "./HomePage";
import { html, Html } from "@elysia/html";

export const pages = new Elysia().use(html()).get("/", () => <HomePage />);
