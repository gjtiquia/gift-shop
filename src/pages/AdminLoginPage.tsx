import { html, Html } from "@elysia/html";
import { PageLayout } from "./layouts/PageLayout";

interface AdminLoginPageProps {
    error?: string;
}

export async function AdminLoginPage({ error }: AdminLoginPageProps = {}) {
    return (
        <PageLayout
            title="Admin sign in"
            width="narrow"
            actions={
                <a
                    class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                    href="/"
                >
                    View catalogue
                </a>
            }
        >
            <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <form
                    class="grid gap-4"
                    method="post"
                    action="/auth/login"
                    data-native-pending
                    aria-busy="false"
                >
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Password
                        <input
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                            type="password"
                            name="password"
                            autocomplete="current-password"
                            required
                            autofocus
                        />
                    </label>
                    {error ? (
                        <p
                            class="text-sm font-medium text-red-700"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : (
                        <></>
                    )}
                    <button
                        class="w-full rounded-md bg-gray-950 px-4 py-2 font-medium text-white sm:w-fit"
                        type="submit"
                        data-pending-label="Signing in…"
                    >
                        Sign in
                    </button>
                </form>
            </section>
        </PageLayout>
    );
}
