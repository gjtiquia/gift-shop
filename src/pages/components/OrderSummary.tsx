import { html, Html } from "@elysia/html";
import type { OrderView } from "../../api/orders/service";
import { formatPrice } from "../../utils";
import { ProductImage } from "./ProductImage";
import { orderStatusClasses, orderTotal } from "./OrderPresentation";

export function OrderSummary({ order }: { order: OrderView }) {
    const colored = order.status !== "unfulfilled";

    return (
        <div class="grid gap-5">
            <dl
                class={`grid gap-2 rounded-lg border p-4 shadow-sm sm:grid-cols-2 ${orderStatusClasses(order.status)}`}
                data-order-status-panel
            >
                <div>
                    <dt
                        class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                    >
                        Order ID
                    </dt>
                    <dd class="break-all font-mono text-sm">{order.id}</dd>
                </div>
                <div>
                    <dt
                        class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                    >
                        Status
                    </dt>
                    <dd class="font-semibold capitalize">{order.status}</dd>
                </div>
                <div>
                    <dt
                        class={`text-xs font-medium uppercase ${colored ? "text-white" : "text-gray-500"}`}
                    >
                        Customer
                    </dt>
                    <dd>{order.customerName}</dd>
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
                <table class="w-full min-w-160 border-collapse text-left text-sm">
                    <thead class="bg-gray-100 text-gray-700">
                        <tr>
                            <th class="px-3 py-3">Image</th>
                            <th class="px-3 py-3">Item</th>
                            <th class="px-3 py-3">Price</th>
                            <th class="px-3 py-3">Quantity</th>
                            <th class="px-3 py-3">Line total</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {order.items.map((item) => {
                            const name =
                                item.inventory?.name ??
                                `Deleted inventory item #${item.inventoryId}`;
                            return (
                                <tr>
                                    <td class="px-3 py-3">
                                        <ProductImage
                                            imageId={
                                                item.inventory?.imageId ?? null
                                            }
                                            name={name}
                                        />
                                    </td>
                                    <td class="px-3 py-3">{name}</td>
                                    <td class="px-3 py-3">
                                        {item.inventory
                                            ? formatPrice(
                                                  item.inventory.priceCentsX10,
                                              )
                                            : "Unavailable"}
                                    </td>
                                    <td class="px-3 py-3">{item.quantity}</td>
                                    <td class="px-3 py-3">
                                        {item.inventory
                                            ? formatPrice(
                                                  item.inventory.priceCentsX10 *
                                                      item.quantity,
                                              )
                                            : "Unavailable"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr class="border-t border-gray-200 font-semibold">
                            <th class="px-3 py-3 text-right" colspan="4">
                                Total:
                            </th>
                            <td class="px-3 py-3">
                                {formatPrice(orderTotal(order))}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
