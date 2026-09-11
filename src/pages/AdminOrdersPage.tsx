import { html, Html } from "@elysia/html";
import type { OrderView } from "../api/orders/service";
import { formatPrice } from "../utils";
import {
    orderStatusClasses,
    orderStatusLinkClasses,
} from "./components/OrderPresentation";
import { PageLayout } from "./layouts/PageLayout";

export function AdminOrdersPage({ orders }: { orders: OrderView[] }) {
    return (
        <PageLayout
            title="Orders"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/admin"
                    >
                        Inventory
                    </a>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/"
                    >
                        Catalogue
                    </a>
                    <form method="post" action="/auth/logout">
                        <button
                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                            type="submit"
                        >
                            Log out
                        </button>
                    </form>
                </>
            }
        >
            {orders.length === 0 ? (
                <p class="rounded-lg border border-gray-200 bg-white p-6 text-gray-600 shadow-sm">
                    No orders yet.
                </p>
            ) : (
                <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table class="w-full min-w-180 border-collapse text-left text-sm">
                        <thead class="bg-gray-100 text-gray-700">
                            <tr>
                                <th class="px-3 py-3">Submitted</th>
                                <th class="px-3 py-3">Customer</th>
                                <th class="px-3 py-3">Status</th>
                                <th class="px-3 py-3">Units</th>
                                <th class="px-3 py-3">Total</th>
                                <th class="px-3 py-3"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            {orders.map((order) => {
                                const units = order.items.reduce(
                                    (sum, item) => sum + item.quantity,
                                    0,
                                );
                                const total = order.items.reduce(
                                    (sum, item) =>
                                        sum +
                                        (item.inventory?.priceCentsX10 ?? 0) *
                                            item.quantity,
                                    0,
                                );
                                return (
                                    <tr
                                        class={orderStatusClasses(order.status)}
                                    >
                                        <td class="px-3 py-3">
                                            {order.createdAt.toLocaleString()}
                                        </td>
                                        <td class="px-3 py-3">
                                            {order.customerName}
                                        </td>
                                        <td class="px-3 py-3 font-medium capitalize">
                                            {order.status}
                                        </td>
                                        <td class="px-3 py-3">{units}</td>
                                        <td class="px-3 py-3">
                                            {formatPrice(total)}
                                        </td>
                                        <td class="px-3 py-3 text-right">
                                            <a
                                                class={`font-medium underline ${orderStatusLinkClasses(order.status)}`}
                                                href={`/admin/orders/${order.id}`}
                                            >
                                                View
                                            </a>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </PageLayout>
    );
}
