import { html, Html } from "@elysia/html";
import type { OrderView } from "../api/orders/service";
import type { OrderStatus } from "../db";
import { formatPrice } from "../utils";
import {
    orderStatusLinkClasses,
    orderTotal,
    orderUnits,
} from "./components/OrderPresentation";
import { PageLayout } from "./layouts/PageLayout";

const groups: Array<{ status: OrderStatus; title: string }> = [
    { status: "unfulfilled", title: "Unfulfilled orders" },
    { status: "fulfilled", title: "Fulfilled orders" },
    { status: "rejected", title: "Rejected orders" },
];

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
                    <form
                        method="post"
                        action="/auth/logout"
                        data-native-pending
                        aria-busy="false"
                    >
                        <button
                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                            type="submit"
                            data-pending-label="Logging out…"
                        >
                            Log out
                        </button>
                    </form>
                </>
            }
        >
            {groups.map((group) => (
                <AdminOrdersTable
                    title={group.title}
                    status={group.status}
                    orders={orders
                        .filter((order) => order.status === group.status)
                        .sort(
                            (first, second) =>
                                second.createdAt.getTime() -
                                first.createdAt.getTime(),
                        )}
                />
            ))}
        </PageLayout>
    );
}

function AdminOrdersTable({
    title,
    status,
    orders,
}: {
    title: string;
    status: OrderStatus;
    orders: OrderView[];
}) {
    const bodyClasses =
        status === "fulfilled"
            ? "divide-y divide-green-600 bg-green-700 text-white"
            : status === "rejected"
              ? "divide-y divide-red-600 bg-red-700 text-white"
              : "divide-y divide-gray-200 bg-white text-gray-950";

    return (
        <section class="grid gap-3">
            <h2 class="text-xl font-semibold">{title}</h2>
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
                    <tbody class={bodyClasses}>
                        {orders.length === 0 ? (
                            <tr>
                                <td class="px-3 py-4" colspan="6">
                                    No {status} orders.
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr>
                                    <td class="px-3 py-3">
                                        {order.createdAt.toLocaleString()}
                                    </td>
                                    <td class="px-3 py-3">
                                        {order.customerName}
                                    </td>
                                    <td class="px-3 py-3 font-medium capitalize">
                                        {order.status}
                                    </td>
                                    <td class="px-3 py-3">
                                        {orderUnits(order)}
                                    </td>
                                    <td class="px-3 py-3">
                                        {formatPrice(orderTotal(order))}
                                    </td>
                                    <td class="px-3 py-3 text-right">
                                        <a
                                            class={`font-medium underline ${orderStatusLinkClasses(status)}`}
                                            href={`/admin/orders/${order.id}`}
                                        >
                                            View
                                        </a>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
