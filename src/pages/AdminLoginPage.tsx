import { html, Html } from "@elysia/html";
import { BaseLayout } from "./layouts/BaseLayout";

interface AdminLoginPageProps {
    error?: string;
}

export async function AdminLoginPage({ error }: AdminLoginPageProps = {}) {
    return (
        <BaseLayout>
            <main class="mx-auto grid max-w-md gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header class="flex flex-wrap items-center justify-between gap-3">
                    <h1 class="text-2xl font-semibold text-gray-950">
                        Gift Shop - Admin Login
                    </h1>
                    <a
                        class="text-sm font-medium text-blue-700 underline"
                        href="/"
                    >
                        View catalogue
                    </a>
                </header>

                <section class="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-6">
                    <form class="grid gap-4" method="post" action="/auth/login">
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
                        >
                            Sign in
                        </button>
                    </form>
                </section>
            </main>
        </BaseLayout>
    );
}
