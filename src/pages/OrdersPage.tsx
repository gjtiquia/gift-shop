import { html, Html } from "@elysia/html";
import type { OrderView } from "../api/orders/service";
import { CartLink } from "./components/CartLink";
import { OrderHistoryList } from "./components/OrderPresentation";
import { PageLayout } from "./layouts/PageLayout";

export function OrdersPage({
    orders,
    cartCount,
}: {
    orders: OrderView[];
    cartCount: number;
}) {
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
                    <CartLink count={cartCount} />
                </>
            }
        >
            <section class="grid gap-4">
                <OrderHistoryList orders={orders} />
            </section>
        </PageLayout>
    );
}
