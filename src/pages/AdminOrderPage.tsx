import { html, Html } from "@elysia/html";
import type { OrderView } from "../api/orders/service";
import type { InventoryItem } from "./components/InventoryRow";
import { OrderSummary } from "./components/OrderSummary";
import { PageLayout } from "./layouts/PageLayout";

interface AdminOrderPageProps {
    order: OrderView;
    inventory: InventoryItem[];
    error?: string;
}

const inputClasses =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";

export function AdminOrderPage({
    order,
    inventory,
    error,
}: AdminOrderPageProps) {
    const newItemIndex = order.items.length;
    return (
        <PageLayout
            title="Order details"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/admin/orders"
                    >
                        Orders
                    </a>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/admin"
                    >
                        Inventory
                    </a>
                </>
            }
        >
            {error ? (
                <p
                    class="rounded-md border border-red-200 bg-red-50 p-3 font-medium text-red-800"
                    role="alert"
                    data-js-nativeAlert
                >
                    {error}
                </p>
            ) : (
                <></>
            )}

            <OrderSummary order={order} showAdminNotes />

            <section class="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h2 class="text-xl font-semibold">Edit order</h2>
                <p class="text-sm text-gray-600">
                    Editing an order never changes inventory.
                </p>
                <form
                    class="grid gap-4"
                    method="post"
                    action={`/api/orders/${order.id}/edit`}
                >
                    <label class="grid max-w-md gap-1 text-sm font-medium text-gray-800">
                        Customer name
                        <input
                            class={inputClasses}
                            name="customerName"
                            maxlength="200"
                            value={order.customerName}
                            required
                        />
                    </label>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-150 text-left text-sm">
                            <thead>
                                <tr>
                                    <th class="py-2 pr-3">Inventory item</th>
                                    <th class="py-2 pr-3">Quantity</th>
                                    <th class="py-2">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, index) => (
                                    <tr>
                                        <td class="py-2 pr-3">
                                            <select
                                                class={inputClasses}
                                                name="inventoryId"
                                                aria-label={`Inventory item ${index + 1}`}
                                                required
                                            >
                                                {!item.inventory ? (
                                                    <option
                                                        value={String(
                                                            item.inventoryId,
                                                        )}
                                                        selected
                                                    >
                                                        Deleted inventory item #
                                                        {item.inventoryId}
                                                    </option>
                                                ) : (
                                                    <></>
                                                )}
                                                {inventory.map(
                                                    (inventoryItem) => (
                                                        <option
                                                            value={String(
                                                                inventoryItem.id,
                                                            )}
                                                            selected={
                                                                inventoryItem.id ===
                                                                item.inventoryId
                                                            }
                                                        >
                                                            {inventoryItem.name}{" "}
                                                            (#
                                                            {inventoryItem.id})
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </td>
                                        <td class="py-2 pr-3">
                                            <input
                                                class={`${inputClasses} w-28`}
                                                type="number"
                                                name="quantity"
                                                min="1"
                                                step="1"
                                                value={String(item.quantity)}
                                                aria-label={`Quantity for item ${index + 1}`}
                                                required
                                            />
                                        </td>
                                        <td class="py-2">
                                            <input
                                                class="size-4"
                                                type="checkbox"
                                                name="remove"
                                                value={String(index)}
                                                aria-label={`Remove item ${index + 1}`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                <tr class="border-t border-gray-200">
                                    <td class="py-3 pr-3">
                                        <select
                                            class={inputClasses}
                                            name="inventoryId"
                                            aria-label="Add inventory item"
                                        >
                                            <option value="">
                                                Add an item…
                                            </option>
                                            {inventory.map((item) => (
                                                <option value={String(item.id)}>
                                                    {item.name} (#{item.id})
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td class="py-3 pr-3">
                                        <input
                                            class={`${inputClasses} w-28`}
                                            type="number"
                                            name="quantity"
                                            min="1"
                                            step="1"
                                            aria-label="Quantity for added item"
                                        />
                                    </td>
                                    <td class="py-3 text-xs text-gray-500">
                                        Save, then repeat to add more items.
                                        <input
                                            type="hidden"
                                            name="newItemIndex"
                                            value={String(newItemIndex)}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Private admin notes
                        <textarea
                            class={inputClasses}
                            name="adminNotes"
                            rows="4"
                        >
                            {order.adminNotes ?? ""}
                        </textarea>
                    </label>
                    <button
                        class="w-fit rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                        type="submit"
                    >
                        Save order
                    </button>
                </form>
            </section>

            <section class="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                {order.status === "unfulfilled" ? (
                    <>
                        <form
                            method="post"
                            action={`/api/orders/${order.id}/fulfill`}
                            onsubmit="return confirm('Fulfill this order and deduct its existing items from inventory?')"
                        >
                            <button
                                class="rounded-md bg-green-700 px-4 py-2 font-medium text-white"
                                type="submit"
                            >
                                Fulfill
                            </button>
                        </form>
                        <form
                            method="post"
                            action={`/api/orders/${order.id}/reject`}
                            onsubmit="return confirm('Reject this order?')"
                        >
                            <button
                                class="rounded-md border border-red-300 px-4 py-2 font-medium text-red-700"
                                type="submit"
                            >
                                Reject
                            </button>
                        </form>
                    </>
                ) : order.status === "rejected" ? (
                    <form
                        method="post"
                        action={`/api/orders/${order.id}/restore`}
                        onsubmit="return confirm('Restore this order to unfulfilled?')"
                    >
                        <button
                            class="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800"
                            type="submit"
                        >
                            Restore to unfulfilled
                        </button>
                    </form>
                ) : (
                    <p class="font-medium text-green-800">
                        Fulfilled status is final. Order fields remain editable.
                    </p>
                )}
            </section>
        </PageLayout>
    );
}
