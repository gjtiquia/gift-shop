import { html, Html } from "@elysia/html";
import { PageLayout } from "./layouts/PageLayout";

export function CartPage() {
    return (
        <PageLayout
            title="Cart"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/orders"
                    >
                        History
                    </a>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/"
                    >
                        Catalogue
                    </a>
                </>
            }
        >
            <section class="grid gap-6" data-js-cartPage>
                <input hidden name="cart" data-js-cartPayload />
                <div
                    hx-post="/cart/contents"
                    hx-trigger="cart-refresh"
                    hx-include="[data-js-cartPayload]"
                    hx-swap="innerHTML"
                    hx-sync="this:replace"
                    data-js-cartContents
                >
                    <p class="text-gray-600">Loading cart…</p>
                </div>
                <p
                    class="font-medium text-red-700"
                    role="alert"
                    data-js-cartError
                ></p>
            </section>
        </PageLayout>
    );
}
