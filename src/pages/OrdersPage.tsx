import { html, Html } from "@elysia/html";
import { PageLayout } from "./layouts/PageLayout";

export function OrdersPage() {
    return (
        <PageLayout
            title="Order history"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/"
                    >
                        Catalogue
                    </a>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/cart"
                        data-js-cartLink
                    >
                        Cart
                    </a>
                </>
            }
        >
            <section class="grid gap-4" data-js-ordersPage>
                <input hidden name="ids" data-js-ordersHistoryPayload />
                <div
                    hx-post="/orders/history"
                    hx-trigger="order-history-refresh"
                    hx-include="[data-js-ordersHistoryPayload]"
                    hx-swap="innerHTML"
                    hx-sync="this:replace"
                    data-js-ordersList
                >
                    <p class="text-gray-600">Loading order history…</p>
                </div>
                <p
                    class="font-medium text-red-700"
                    role="alert"
                    data-js-ordersError
                ></p>
            </section>
        </PageLayout>
    );
}
