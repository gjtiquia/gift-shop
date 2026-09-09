import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";

export const auth = new Elysia({ prefix: "auth" })
    .use(html())
    .get("/login", () => {
        // require password
        // return error if wrong password
        // create session if correct password


    });
