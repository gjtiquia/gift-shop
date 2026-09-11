import { html, Html } from "@elysia/html";
import type { OrderView } from "../api/orders/service";
import { CartLink } from "./components/CartLink";
import { OrderSummary } from "./components/OrderSummary";
import { PageLayout } from "./layouts/PageLayout";

export function OrderPage({
    order,
    cartCount,
}: {
    order: OrderView;
    cartCount: number;
}) {
    return (
        <PageLayout
            title="Order"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/orders"
                    >
                        History
                    </a>
                    <CartLink count={cartCount} />
                </>
            }
        >
            <OrderSummary order={order} />
        </PageLayout>
    );
}

export function OrderNotFoundPage() {
    return (
        <PageLayout title="Order not found" width="narrow">
            <p class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                This order does not exist or is no longer available.
            </p>
            <a class="text-blue-700 underline" href="/orders">
                Return to order history
            </a>
        </PageLayout>
    );
}
