import { html, Html } from "@elysia/html";
import type { OrderView } from "../../api/orders/service";
import { formatPrice } from "../../utils";

export function OrderSummary({
    order,
    showAdminNotes = false,
}: {
    order: OrderView;
    showAdminNotes?: boolean;
}) {
    const total = order.items.reduce(
        (sum, item) =>
            sum + (item.inventory?.priceCentsX10 ?? 0) * item.quantity,
        0,
    );
    const hasMissingItem = order.items.some((item) => !item.inventory);

    return (
        <div class="grid gap-5">
            <dl class="grid gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2">
                <div>
                    <dt class="text-xs font-medium text-gray-500 uppercase">
                        Order ID
                    </dt>
                    <dd class="break-all font-mono text-sm">{order.id}</dd>
                </div>
                <div>
                    <dt class="text-xs font-medium text-gray-500 uppercase">
                        Status
                    </dt>
                    <dd class="font-semibold capitalize">{order.status}</dd>
                </div>
                <div>
                    <dt class="text-xs font-medium text-gray-500 uppercase">
                        Customer
                    </dt>
                    <dd>{order.customerName}</dd>
                </div>
                <div>
                    <dt class="text-xs font-medium text-gray-500 uppercase">
                        Submitted
                    </dt>
                    <dd>{order.createdAt.toLocaleString()}</dd>
                </div>
            </dl>
            <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table class="w-full min-w-120 border-collapse text-left text-sm">
                    <thead class="bg-gray-100 text-gray-700">
                        <tr>
                            <th class="px-3 py-3">Item</th>
                            <th class="px-3 py-3">Current marked price</th>
                            <th class="px-3 py-3">Quantity</th>
                            <th class="px-3 py-3">Current marked total</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {order.items.map((item) => (
                            <tr>
                                <td class="px-3 py-3">
                                    {item.inventory?.name ??
                                        `Deleted inventory item #${item.inventoryId}`}
                                </td>
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
                        ))}
                    </tbody>
                    <tfoot>
                        <tr class="border-t border-gray-200 font-semibold">
                            <th class="px-3 py-3 text-right" colspan="3">
                                Current marked total
                            </th>
                            <td class="px-3 py-3">
                                {formatPrice(total)}
                                {hasMissingItem
                                    ? " plus unavailable items"
                                    : ""}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {showAdminNotes ? (
                <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <h2 class="font-semibold">Private admin notes</h2>
                    <p class="whitespace-pre-wrap text-gray-700">
                        {order.adminNotes || "No admin notes."}
                    </p>
                </section>
            ) : (
                <></>
            )}
        </div>
    );
}
