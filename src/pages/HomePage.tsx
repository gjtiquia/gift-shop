import { html, Html } from "@elysia/html";
import { asc, eq } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { formatPrice } from "../utils";
import { PageLayout } from "./layouts/PageLayout";

export async function HomePage() {
    const items = await db
        .select({
            id: inventoryTable.id,
            name: inventoryTable.name,
            priceCentsX10: inventoryTable.priceCentsX10,
            quantity: inventoryTable.quantity,
            imageId: inventoryTable.imageId,
        })
        .from(inventoryTable)
        .where(eq(inventoryTable.hidden, false))
        .orderBy(asc(inventoryTable.id));

    return (
        <PageLayout
            title="Catalogue"
            actions={
                <a
                    class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                    href="/cart"
                    data-js-cartLink
                >
                    Cart
                </a>
            }
            footerActions={
                <a
                    class="text-xs text-gray-400 hover:text-gray-600"
                    href="/admin"
                >
                    Admin
                </a>
            }
        >
            {items.length === 0 ? (
                <p class="rounded-lg border border-gray-200 bg-white p-6 text-gray-600 shadow-sm">
                    No products are available yet.
                </p>
            ) : (
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => (
                        <article class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                            {item.imageId !== null ? (
                                <img
                                    class="aspect-4/3 w-full bg-gray-100 object-cover"
                                    src={`/api/images/${item.imageId}`}
                                    width="640"
                                    height="480"
                                    loading="lazy"
                                    decoding="async"
                                    alt={`Photo of ${item.name}`}
                                />
                            ) : (
                                <div
                                    class="flex aspect-4/3 w-full items-center justify-center bg-gray-100 px-4 text-center text-sm text-gray-500"
                                    role="img"
                                    aria-label={`No image available for ${item.name}`}
                                >
                                    No image available
                                </div>
                            )}
                            <div
                                class="grid gap-3 p-4"
                                data-js-catalogueItem
                                data-inventory-id={String(item.id)}
                                data-max-quantity={String(item.quantity)}
                            >
                                <h2 class="text-lg font-semibold text-gray-950">
                                    {item.name}
                                </h2>
                                <p class="text-base font-medium text-gray-900">
                                    {formatPrice(item.priceCentsX10)}
                                </p>
                                <p class="text-sm text-gray-600">
                                    {item.quantity === 0
                                        ? "Out of stock"
                                        : `${item.quantity} in stock`}
                                </p>
                                <div class="flex flex-wrap items-center gap-2">
                                    <div class="flex items-center rounded-md border border-gray-300">
                                        <button
                                            class="px-3 py-2 font-medium disabled:text-gray-300"
                                            type="button"
                                            aria-label={`Decrease ${item.name} quantity`}
                                            data-js-quantityDecrease
                                            disabled={item.quantity === 0}
                                        >
                                            −
                                        </button>
                                        <input
                                            class="w-14 border-x border-gray-300 py-2 text-center"
                                            type="number"
                                            min="1"
                                            max={String(item.quantity)}
                                            step="1"
                                            value="1"
                                            aria-label={`${item.name} quantity`}
                                            data-js-quantityInput
                                            disabled={item.quantity === 0}
                                        />
                                        <button
                                            class="px-3 py-2 font-medium disabled:text-gray-300"
                                            type="button"
                                            aria-label={`Increase ${item.name} quantity`}
                                            data-js-quantityIncrease
                                            disabled={item.quantity === 0}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <button
                                        class="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
                                        type="button"
                                        data-js-addToCart
                                        disabled={item.quantity === 0}
                                    >
                                        Add
                                    </button>
                                    <span
                                        class="text-sm text-green-700"
                                        aria-live="polite"
                                        data-js-addedMessage
                                    ></span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </PageLayout>
    );
}
