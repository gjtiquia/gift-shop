import { html, Html } from "@elysia/html";
import type { OrderView } from "../api/orders/service";
import { formatPrice } from "../utils";
import type { InventoryItem } from "./components/InventoryRow";
import { ProductImage } from "./components/ProductImage";
import { orderStatusClasses, orderTotal } from "./components/OrderPresentation";
import { PageLayout } from "./layouts/PageLayout";

interface AdminOrderPageProps {
    order: OrderView;
    inventory: InventoryItem[];
    error?: string;
}

const inputClasses =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900";

export function AdminOrderPage({
    order,
    inventory,
    error,
}: AdminOrderPageProps) {
    const colored = order.status !== "unfulfilled";
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

            <section class="grid gap-4" data-js-orderEditor>
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm text-gray-600">
                        Editing an order never changes inventory.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                            type="button"
                            data-js-orderEdit
                        >
                            Edit
                        </button>
                        <button
                            class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                            type="submit"
                            form="order-edit-form"
                            data-js-orderSave
                            hidden
                        >
                            Save changes
                        </button>
                        <button
                            class="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800"
                            type="button"
                            data-js-orderDiscard
                            hidden
                        >
                            Discard changes
                        </button>
                    </div>
                </div>

                <form
                    id="order-edit-form"
                    class="grid gap-5"
                    method="post"
                    action={`/api/orders/${order.id}/edit`}
                    data-js-orderEditForm
                >
                    <dl
                        class={`grid gap-3 rounded-lg border p-4 shadow-sm sm:grid-cols-2 ${orderStatusClasses(order.status)}`}
                        data-order-status-panel
                    >
                        <div>
                            <dt
                                class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                            >
                                Order ID
                            </dt>
                            <dd class="break-all font-mono text-sm">
                                {order.id}
                            </dd>
                        </div>
                        <div>
                            <dt
                                class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                            >
                                Status
                            </dt>
                            <dd class="font-semibold capitalize">
                                {order.status}
                            </dd>
                        </div>
                        <div>
                            <dt
                                class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                            >
                                Customer
                            </dt>
                            <dd data-js-orderReadOnly>{order.customerName}</dd>
                            <input
                                class={inputClasses}
                                name="customerName"
                                aria-label="Customer name"
                                maxlength="200"
                                value={order.customerName}
                                required
                                disabled
                                hidden
                                data-js-orderField
                                data-js-orderEditOnly
                            />
                        </div>
                        <div>
                            <dt
                                class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                            >
                                Submitted
                            </dt>
                            <dd>{order.createdAt.toLocaleString()}</dd>
                        </div>
                    </dl>

                    <div
                        class="overflow-x-auto rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm"
                        data-order-items-table
                    >
                        <table class="w-full min-w-240 border-collapse text-left text-sm">
                            <thead class="bg-gray-100 text-gray-700">
                                <tr>
                                    <th class="px-3 py-3">Image</th>
                                    <th class="px-3 py-3">Item</th>
                                    <th class="px-3 py-3">Price</th>
                                    <th class="px-3 py-3">Quantity</th>
                                    <th class="px-3 py-3">Line total</th>
                                    <th class="px-3 py-3">
                                        Private item notes
                                    </th>
                                    <th
                                        class="px-3 py-3"
                                        data-js-orderEditOnly
                                        hidden
                                    >
                                        Remove
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                {order.items.map((item, index) => {
                                    const name =
                                        item.inventory?.name ??
                                        `Deleted inventory item #${item.inventoryId}`;
                                    return (
                                        <tr>
                                            <td class="px-3 py-3">
                                                <ProductImage
                                                    imageId={
                                                        item.inventory
                                                            ?.imageId ?? null
                                                    }
                                                    name={name}
                                                />
                                            </td>
                                            <td class="px-3 py-3">
                                                <span data-js-orderReadOnly>
                                                    {name}
                                                </span>
                                                <select
                                                    class={inputClasses}
                                                    name="inventoryId"
                                                    aria-label={`Inventory item ${index + 1}`}
                                                    required
                                                    disabled
                                                    hidden
                                                    data-js-orderField
                                                    data-js-orderEditOnly
                                                >
                                                    {!item.inventory ? (
                                                        <option
                                                            value={String(
                                                                item.inventoryId,
                                                            )}
                                                            selected
                                                        >
                                                            {name}
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
                                                                {
                                                                    inventoryItem.name
                                                                }{" "}
                                                                (#
                                                                {
                                                                    inventoryItem.id
                                                                }
                                                                )
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </td>
                                            <td class="px-3 py-3">
                                                {item.inventory
                                                    ? formatPrice(
                                                          item.inventory
                                                              .priceCentsX10,
                                                      )
                                                    : "Unavailable"}
                                            </td>
                                            <td class="px-3 py-3">
                                                <span data-js-orderReadOnly>
                                                    {item.quantity}
                                                </span>
                                                <input
                                                    class={`${inputClasses} w-24`}
                                                    type="number"
                                                    name="quantity"
                                                    min="1"
                                                    step="1"
                                                    value={String(
                                                        item.quantity,
                                                    )}
                                                    aria-label={`Quantity for item ${index + 1}`}
                                                    required
                                                    disabled
                                                    hidden
                                                    data-js-orderField
                                                    data-js-orderEditOnly
                                                />
                                            </td>
                                            <td class="px-3 py-3">
                                                {item.inventory
                                                    ? formatPrice(
                                                          item.inventory
                                                              .priceCentsX10 *
                                                              item.quantity,
                                                      )
                                                    : "Unavailable"}
                                            </td>
                                            <td class="px-3 py-3">
                                                <span
                                                    class="whitespace-pre-wrap"
                                                    data-js-orderReadOnly
                                                >
                                                    {item.adminNotes ||
                                                        "No notes."}
                                                </span>
                                                <textarea
                                                    class={inputClasses}
                                                    name="itemAdminNotes"
                                                    rows="3"
                                                    maxlength="2000"
                                                    aria-label={`Private notes for ${name}, item ${index + 1}`}
                                                    disabled
                                                    hidden
                                                    data-js-orderField
                                                    data-js-orderEditOnly
                                                >
                                                    {item.adminNotes ?? ""}
                                                </textarea>
                                            </td>
                                            <td
                                                class="px-3 py-3"
                                                data-js-orderEditOnly
                                                hidden
                                            >
                                                <input
                                                    class="size-4 bg-white"
                                                    type="checkbox"
                                                    name="remove"
                                                    value={String(index)}
                                                    aria-label={`Remove item ${index + 1}`}
                                                    disabled
                                                    data-js-orderField
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr
                                    class="border-t border-gray-200"
                                    data-js-orderEditOnly
                                    hidden
                                >
                                    <td class="px-3 py-3 text-center text-xs">
                                        New item
                                    </td>
                                    <td class="px-3 py-3">
                                        <select
                                            class={inputClasses}
                                            name="inventoryId"
                                            aria-label="Add inventory item"
                                            disabled
                                            data-js-orderField
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
                                    <td class="px-3 py-3">—</td>
                                    <td class="px-3 py-3">
                                        <input
                                            class={`${inputClasses} w-24`}
                                            type="number"
                                            name="quantity"
                                            min="1"
                                            step="1"
                                            aria-label="Quantity for added item"
                                            disabled
                                            data-js-orderField
                                        />
                                    </td>
                                    <td class="px-3 py-3">—</td>
                                    <td class="px-3 py-3">
                                        <textarea
                                            class={inputClasses}
                                            name="itemAdminNotes"
                                            rows="3"
                                            maxlength="2000"
                                            aria-label="Private notes for added item"
                                            disabled
                                            data-js-orderField
                                        ></textarea>
                                    </td>
                                    <td class="px-3 py-3 text-xs">
                                        Save, then repeat to add another item.
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr class="border-t border-gray-200 font-semibold">
                                    <th
                                        class="px-3 py-3 text-right"
                                        colspan="6"
                                    >
                                        Total:
                                    </th>
                                    <td class="px-3 py-3">
                                        {formatPrice(orderTotal(order))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <section class="rounded-lg border border-gray-200 bg-white p-4 text-gray-950 shadow-sm">
                        <h2 class="font-semibold">Private admin notes</h2>
                        <p class="whitespace-pre-wrap" data-js-orderReadOnly>
                            {order.adminNotes || "No admin notes."}
                        </p>
                        <textarea
                            class={inputClasses}
                            name="adminNotes"
                            rows="4"
                            maxlength="2000"
                            aria-label="Private order notes"
                            disabled
                            hidden
                            data-js-orderField
                            data-js-orderEditOnly
                        >
                            {order.adminNotes ?? ""}
                        </textarea>
                    </section>
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
