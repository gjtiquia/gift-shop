import { html, Html } from "@elysia/html";
import type { CartItemView } from "../api/cart/service";
import { CartContents } from "./components/CartContents";
import { PageLayout } from "./layouts/PageLayout";

export function CartPage({
    items,
    error,
}: {
    items: CartItemView[];
    error?: string;
}) {
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
            <section class="grid gap-6">
                <div id="cart-region">
                    <CartContents
                        items={items}
                        submissionId={crypto.randomUUID()}
                        error={error}
                    />
                </div>
            </section>
        </PageLayout>
    );
}
