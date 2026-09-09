import { Elysia } from "elysia";
import { HomePage } from "./HomePage";
import { html, Html } from "@elysia/html";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminPage } from "./AdminPage";

export const pages = new Elysia()
    .use(html())
    .get("/", () => <HomePage />)
    .get("/admin/login", () => {
        // TODO : if already logged in, redirect to admin page
        return <AdminLoginPage />;
    })
    .get("/admin", () => {
        // TODO : if not logged in, redirect to login page
        return <AdminPage />;
    });
