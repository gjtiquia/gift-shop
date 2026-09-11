import { html, Html } from "@elysia/html";
import { formatPrice } from "../../utils";
import { ProductImage } from "./ProductImage";

export interface CartContentsItem {
    inventoryId: number;
    quantity: number;
    inventory: {
        name: string;
        priceCentsX10: number;
        quantity: number;
        imageId: number | null;
    } | null;
}

export function CartContents({
    items,
    revision,
}: {
    items: CartContentsItem[];
    revision: string;
}) {
    const total = items.reduce(
        (sum, item) =>
            sum + (item.inventory?.priceCentsX10 ?? 0) * item.quantity,
        0,
    );

    if (items.length === 0) {
        return (
            <div data-js-cartRendered data-cart-revision={revision}>
                <p class="text-gray-600">Your cart is empty.</p>
            </div>
        );
    }

    return (
        <div
            class="grid gap-4"
            data-js-cartRendered
            data-cart-revision={revision}
        >
            {items.map((item) => {
                const name =
                    item.inventory?.name ??
                    `Deleted inventory item #${item.inventoryId}`;
                return (
                    <article
                        class="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr_auto] sm:items-center"
                        data-js-cartItem
                        data-inventory-id={String(item.inventoryId)}
                        data-max-quantity={
                            item.inventory
                                ? String(item.inventory.quantity)
                                : ""
                        }
                    >
                        <ProductImage
                            imageId={item.inventory?.imageId ?? null}
                            name={name}
                            class="size-24 rounded-md bg-gray-100 object-cover"
                        />
                        <div class="grid gap-1">
                            <h2 class="font-semibold">{name}</h2>
                            <p class="text-sm text-gray-600">
                                Price:{" "}
                                {item.inventory
                                    ? formatPrice(item.inventory.priceCentsX10)
                                    : "Unavailable"}
                            </p>
                            <p class="font-medium">
                                Line total:{" "}
                                {item.inventory
                                    ? formatPrice(
                                          item.inventory.priceCentsX10 *
                                              item.quantity,
                                      )
                                    : "Unavailable"}
                            </p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <button
                                class="rounded-md border border-gray-300 px-3 py-2 font-medium disabled:text-gray-300"
                                type="button"
                                aria-label={`Decrease ${name} quantity`}
                                data-js-cartDecrease
                                disabled={item.quantity <= 1}
                            >
                                −
                            </button>
                            <input
                                class="w-16 rounded-md border border-gray-300 px-2 py-2 text-center"
                                type="number"
                                min="1"
                                max={
                                    item.inventory &&
                                    item.inventory.quantity > 0
                                        ? String(item.inventory.quantity)
                                        : undefined
                                }
                                step="1"
                                value={String(item.quantity)}
                                aria-label={`${name} quantity`}
                                data-js-cartQuantity
                            />
                            <button
                                class="rounded-md border border-gray-300 px-3 py-2 font-medium disabled:text-gray-300"
                                type="button"
                                aria-label={`Increase ${name} quantity`}
                                data-js-cartIncrease
                                disabled={
                                    item.inventory
                                        ? item.quantity >=
                                          item.inventory.quantity
                                        : false
                                }
                            >
                                +
                            </button>
                            <button
                                class="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
                                type="button"
                                aria-label={`Remove ${name}`}
                                data-js-cartRemove
                            >
                                Remove
                            </button>
                        </div>
                    </article>
                );
            })}
            <p class="text-right text-lg font-semibold">
                Total: {formatPrice(total)}
            </p>
        </div>
    );
}
