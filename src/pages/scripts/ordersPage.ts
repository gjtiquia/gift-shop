import { formatPrice } from "../../utils";
import { readOrderHistory } from "./cartStorage";

interface OrderListItem {
    id: string;
    customerName: string;
    status: string;
    createdAt: string;
    items: Array<{
        quantity: number;
        inventory: { priceCentsX10: number } | null;
    }>;
}

for (const page of document.querySelectorAll<HTMLElement>(
    "[data-js-ordersPage]",
)) {
    void renderOrders(page);
}

async function renderOrders(page: HTMLElement) {
    const loading = page.querySelector<HTMLElement>("[data-js-ordersLoading]");
    const error = page.querySelector<HTMLElement>("[data-js-ordersError]");
    const list = page.querySelector<HTMLElement>("[data-js-ordersList]");
    if (!loading || !error || !list) return;

    const ids = readOrderHistory();
    if (ids.length === 0) {
        loading.textContent =
            "No orders have been submitted from this browser.";
        return;
    }
    try {
        const response = await fetch(
            `/api/orders?ids=${encodeURIComponent(ids.join(","))}`,
        );
        if (!response.ok) throw new Error("Could not load order history.");
        const orders = (await response.json()) as OrderListItem[];
        loading.textContent =
            orders.length === 0 ? "No saved orders were found." : "";
        for (const order of orders) list.append(createOrderLink(order));
    } catch (caught) {
        loading.textContent = "";
        error.textContent =
            caught instanceof Error
                ? caught.message
                : "Could not load order history.";
    }
}

function createOrderLink(order: OrderListItem) {
    const link = document.createElement("a");
    link.className =
        "grid gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400 sm:grid-cols-4";
    link.href = `/orders/${order.id}`;
    const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const total = order.items.reduce(
        (sum, item) =>
            sum + (item.inventory?.priceCentsX10 ?? 0) * item.quantity,
        0,
    );
    for (const text of [
        new Date(order.createdAt).toLocaleString(),
        order.customerName,
        `${order.status[0]?.toUpperCase()}${order.status.slice(1)}`,
        `${units} units · ${formatPrice(total)} current total`,
    ]) {
        const span = document.createElement("span");
        span.textContent = text;
        link.append(span);
    }
    return link;
}
