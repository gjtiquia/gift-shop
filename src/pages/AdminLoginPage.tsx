import { html, Html } from "@elysia/html";
import { BaseLayout } from "./layouts/BaseLayout";

export async function AdminLoginPage() {

    // TODO : on submit, sends to backend
    // TODO : if password correct, backend creates a session, and saves in a cookie, and redirects to admin page
    // TODO : if password incorrect, should reload with an red text

    return (
        <BaseLayout>
            <h1>Gift Shop - Admin Login Page</h1>
            <form>
                <input type="password" />
                <button>Submit</button>
            </form>
        </BaseLayout>
    );
}
