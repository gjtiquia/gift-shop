import { html, Html } from "@elysia/html";
import { asc, eq } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { formatPrice } from "../utils";
import { PageLayout } from "./layouts/PageLayout";

export async function HomePage() {
    const items = await db
        .select({
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
                            <div class="grid gap-2 p-4">
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
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </PageLayout>
    );
}
