import { html, Html } from "@elysia/html";
import { PageLayout } from "./layouts/PageLayout";

export function OrdersPage() {
    return (
        <PageLayout
            title="Order history"
            actions={
                <a
                    class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                    href="/cart"
                    data-js-cartLink
                >
                    Cart
                </a>
            }
        >
            <section class="grid gap-4" data-js-ordersPage>
                <p class="text-gray-600" data-js-ordersLoading>
                    Loading order history…
                </p>
                <p
                    class="font-medium text-red-700"
                    role="alert"
                    data-js-ordersError
                ></p>
                <div class="grid gap-3" data-js-ordersList></div>
            </section>
        </PageLayout>
    );
}
