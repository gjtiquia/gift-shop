import { html, Html } from "@elysia/html";
import type { OrderView } from "../../api/orders/service";
import type { OrderStatus } from "../../db";
import { formatPrice } from "../../utils";

export function orderStatusClasses(status: OrderStatus) {
    if (status === "fulfilled") {
        return "border-green-800 bg-green-700 text-white";
    }
    if (status === "rejected") {
        return "border-red-800 bg-red-700 text-white";
    }
    return "border-gray-200 bg-white text-gray-950";
}

export function orderStatusLinkClasses(status: OrderStatus) {
    return status === "unfulfilled"
        ? "text-blue-700"
        : "text-white decoration-white";
}

export function orderTotal(order: OrderView) {
    return order.items.reduce(
        (sum, item) =>
            sum + (item.inventory?.priceCentsX10 ?? 0) * item.quantity,
        0,
    );
}

export function orderUnits(order: OrderView) {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function OrderHistoryList({ orders }: { orders: OrderView[] }) {
    if (orders.length === 0) {
        return <p class="text-gray-600">No saved orders were found.</p>;
    }

    return (
        <div class="grid gap-3">
            {orders.map((order) => (
                <a
                    class={`grid gap-2 rounded-lg border p-4 shadow-sm hover:opacity-90 sm:grid-cols-4 ${orderStatusClasses(order.status)}`}
                    href={`/orders/${order.id}`}
                >
                    <span>{order.createdAt.toLocaleString()}</span>
                    <span>{order.customerName}</span>
                    <span class="font-semibold capitalize">{order.status}</span>
                    <span>
                        {orderUnits(order)} units ·{" "}
                        {formatPrice(orderTotal(order))}
                    </span>
                </a>
            ))}
        </div>
    );
}
