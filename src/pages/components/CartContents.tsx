import { html, Html } from "@elysia/html";
import { formatPrice } from "../../utils";
import type { CartItemView } from "../../api/cart/service";
import { ProductImage } from "./ProductImage";

export function CartContents({
    items,
    submissionId,
    error,
}: {
    items: CartItemView[];
    submissionId: string;
    error?: string;
}) {
    const total = items.reduce(
        (sum, item) => sum + item.inventory.priceCentsX10 * item.quantity,
        0,
    );

    return (
        <div id="cart-contents" class="grid gap-4">
            <p id="cart-error" class="font-medium text-red-700" role="alert">
                {error ?? ""}
            </p>
            {items.length === 0 ? (
                <p class="text-gray-600">Your cart is empty.</p>
            ) : (
                <>
                    {items.map((item) => (
                        <article class="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">
                            <ProductImage
                                imageId={item.inventory.imageId}
                                name={item.inventory.name}
                                class="size-24 rounded-md bg-gray-100 object-cover"
                            />
                            <div class="grid gap-1">
                                <h2 class="font-semibold">
                                    {item.inventory.name}
                                </h2>
                                <p class="text-sm text-gray-600">
                                    Price:{" "}
                                    {formatPrice(item.inventory.priceCentsX10)}
                                </p>
                                <p class="font-medium">
                                    Line total:{" "}
                                    {formatPrice(
                                        item.inventory.priceCentsX10 *
                                            item.quantity,
                                    )}
                                </p>
                            </div>
                            <div class="grid justify-items-end gap-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <form
                                        method="post"
                                        action={`/api/cart/items/${item.inventoryId}/decrease`}
                                        hx-post={`/api/cart/items/${item.inventoryId}/decrease`}
                                        hx-target="#cart-region"
                                        hx-swap="innerHTML"
                                        hx-sync="#cart-region:queue all"
                                        data-htmx-error="#cart-error"
                                    >
                                        <button
                                            class="rounded-md border border-gray-300 px-3 py-2 font-medium disabled:text-gray-300"
                                            type="submit"
                                            aria-label={`Decrease ${item.inventory.name} quantity`}
                                            disabled={item.quantity <= 1}
                                        >
                                            −
                                        </button>
                                    </form>
                                    <form
                                        class="flex items-center gap-2"
                                        method="post"
                                        action={`/api/cart/items/${item.inventoryId}`}
                                        hx-post={`/api/cart/items/${item.inventoryId}`}
                                        hx-target="#cart-region"
                                        hx-swap="innerHTML"
                                        hx-sync="#cart-region:queue all"
                                        data-htmx-error="#cart-error"
                                    >
                                        <input
                                            class="w-16 rounded-md border border-gray-300 px-2 py-2 text-center"
                                            type="number"
                                            name="quantity"
                                            min="1"
                                            max={String(
                                                item.inventory.quantity,
                                            )}
                                            step="1"
                                            value={String(item.quantity)}
                                            aria-label={`${item.inventory.name} quantity`}
                                        />
                                        <button
                                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"
                                            type="submit"
                                        >
                                            Update
                                        </button>
                                    </form>
                                    <form
                                        method="post"
                                        action={`/api/cart/items/${item.inventoryId}/increase`}
                                        hx-post={`/api/cart/items/${item.inventoryId}/increase`}
                                        hx-target="#cart-region"
                                        hx-swap="innerHTML"
                                        hx-sync="#cart-region:queue all"
                                        data-htmx-error="#cart-error"
                                    >
                                        <button
                                            class="rounded-md border border-gray-300 px-3 py-2 font-medium disabled:text-gray-300"
                                            type="submit"
                                            aria-label={`Increase ${item.inventory.name} quantity`}
                                            disabled={
                                                item.quantity >=
                                                item.inventory.quantity
                                            }
                                        >
                                            +
                                        </button>
                                    </form>
                                </div>
                                <form
                                    method="post"
                                    action={`/api/cart/items/${item.inventoryId}/remove`}
                                    hx-post={`/api/cart/items/${item.inventoryId}/remove`}
                                    hx-target="#cart-region"
                                    hx-swap="innerHTML"
                                    hx-sync="#cart-region:queue all"
                                    data-htmx-error="#cart-error"
                                >
                                    <button
                                        class="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
                                        type="submit"
                                        aria-label={`Remove ${item.inventory.name}`}
                                    >
                                        Remove
                                    </button>
                                </form>
                            </div>
                        </article>
                    ))}
                    <p class="text-right text-lg font-semibold">
                        Total: {formatPrice(total)}
                    </p>
                    <form
                        class="grid max-w-md gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                        method="post"
                        action="/api/orders"
                        onsubmit="return confirm('Submit this order?')"
                    >
                        <input
                            type="hidden"
                            name="submissionId"
                            value={submissionId}
                        />
                        <label class="grid gap-1 text-sm font-medium text-gray-800">
                            Customer name
                            <input
                                id="cart-customer-name"
                                class="rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                                name="customerName"
                                maxlength="200"
                                required
                                hx-preserve
                            />
                        </label>
                        <button
                            class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white disabled:bg-gray-400"
                            type="submit"
                        >
                            Submit order
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}
