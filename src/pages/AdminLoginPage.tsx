import { html, Html } from "@elysia/html";
import { BaseLayout } from "./layouts/BaseLayout";

interface AdminLoginPageProps {
    error?: string;
}

export async function AdminLoginPage({ error }: AdminLoginPageProps = {}) {
    return (
        <BaseLayout>
            <h1>Gift Shop - Admin Login Page</h1>
            {error ? <p style="color: red;">{error}</p> : <></>}
            <form method="post" action="/auth/login">
                <input
                    type="password"
                    name="password"
                    autocomplete="current-password"
                    required
                />
                <button type="submit">Submit</button>
            </form>
        </BaseLayout>
    );
}
