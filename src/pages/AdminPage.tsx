import { html, Html } from "@elysia/html";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { InventoryTableBody } from "./components/InventoryRow";
import { PageLayout } from "./layouts/PageLayout";
import { countUnfulfilledOrders } from "../api/orders/service";

interface AdminPageProps {
    error?: string;
}

const inputClasses =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";

export async function AdminPage({ error }: AdminPageProps = {}) {
    const [items, unfulfilledOrderCount] = await Promise.all([
        db.select().from(inventoryTable).orderBy(asc(inventoryTable.id)),
        countUnfulfilledOrders(),
    ]);

    return (
        <PageLayout
            title="Inventory"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/admin/orders"
                    >
                        {unfulfilledOrderCount > 0
                            ? `Orders (${unfulfilledOrderCount})`
                            : "Orders"}
                    </a>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/"
                    >
                        Catalogue
                    </a>
                    <form method="post" action="/auth/logout">
                        <button
                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                            type="submit"
                        >
                            Log out
                        </button>
                    </form>
                </>
            }
        >
            <p
                id="inventory-error"
                class="min-h-6 text-sm font-medium text-red-700 empty:hidden"
                data-js-inventoryError
                role="alert"
            >
                {error ?? ""}
            </p>

            <section class="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 class="text-xl font-semibold text-gray-950">
                    Add inventory
                </h2>
                <form
                    class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
                    method="post"
                    action="/api/inventory"
                    enctype="multipart/form-data"
                >
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Name
                        <input class={inputClasses} name="name" required />
                    </label>
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Price
                        <input
                            class={inputClasses}
                            name="price"
                            inputmode="decimal"
                            placeholder="9.99"
                            required
                        />
                    </label>
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Quantity
                        <input
                            class={inputClasses}
                            type="number"
                            name="quantity"
                            min="0"
                            step="1"
                            required
                        />
                    </label>
                    <label class="grid content-start gap-2 text-sm font-medium text-gray-800">
                        Catalogue
                        <span class="flex items-center gap-2 py-2">
                            <input
                                class="size-4 rounded border-gray-300"
                                type="checkbox"
                                name="hidden"
                                value="true"
                                aria-label="Hide new inventory item from catalogue"
                            />
                            Hidden
                        </span>
                    </label>
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Notes
                        <input class={inputClasses} name="adminNotes" />
                    </label>
                    <label class="grid gap-2 text-sm font-medium text-gray-800 sm:col-span-2 lg:col-span-5">
                        Take photo or choose image (optional)
                        <input
                            class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-2 file:font-medium"
                            type="file"
                            name="image"
                            accept="image/jpeg,image/png,image/webp"
                            data-js-imagePreview
                            data-image-preview="new-inventory-image-preview"
                            data-image-filename="new-inventory-image-filename"
                        />
                        <span
                            id="new-inventory-image-filename"
                            class="text-xs font-normal text-gray-600"
                            aria-live="polite"
                        ></span>
                        <img
                            id="new-inventory-image-preview"
                            class="aspect-4/3 w-40 rounded-md bg-gray-100 object-cover"
                            width="160"
                            height="120"
                            alt="Selected inventory image preview"
                            hidden
                        />
                    </label>
                    <button
                        class="w-full rounded-md bg-gray-950 px-4 py-2 font-medium text-white sm:w-fit"
                        type="submit"
                    >
                        Add
                    </button>
                </form>
            </section>

            <section data-js-inventoryEditor>
                <form
                    class="grid gap-4"
                    method="post"
                    action="/api/inventory/bulk"
                    enctype="multipart/form-data"
                    hx-post="/api/inventory/bulk"
                    hx-target="#inventory-table-body"
                    hx-swap="outerHTML"
                    data-htmx-error="#inventory-error"
                    data-js-inventoryBulkForm
                >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <h2 class="text-xl font-semibold text-gray-950">
                            Inventory
                        </h2>
                        <div class="flex flex-wrap gap-2">
                            <button
                                class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                                data-js-inventoryEdit
                                type="button"
                            >
                                Edit
                            </button>
                            <button
                                class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                                data-js-inventorySave
                                type="submit"
                                hidden
                            >
                                Save changes
                            </button>
                            <button
                                class="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800"
                                data-js-inventoryDiscard
                                type="button"
                                hidden
                            >
                                Discard changes
                            </button>
                        </div>
                    </div>
                    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                        <table class="min-w-245 border-collapse text-left text-sm">
                            <thead class="bg-gray-100 text-gray-700">
                                <tr>
                                    <th class="px-3 py-3" scope="col">
                                        ID
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Image
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Name
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Price
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Quantity
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Hidden
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Notes
                                    </th>
                                    <th
                                        class="px-3 py-3"
                                        scope="col"
                                        data-js-inventoryEditOnly
                                        hidden
                                    >
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <InventoryTableBody items={items} />
                        </table>
                    </div>
                </form>
            </section>
        </PageLayout>
    );
}
