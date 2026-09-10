import { html, Html } from "@elysia/html";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { InventoryRow } from "./components/InventoryRow";
import { BaseLayout } from "./layouts/BaseLayout";

interface AdminPageProps {
    error?: string;
}

const inputClasses =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";

export async function AdminPage({ error }: AdminPageProps = {}) {
    const items = await db
        .select()
        .from(inventoryTable)
        .orderBy(asc(inventoryTable.id));

    return (
        <BaseLayout>
            <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <header class="mb-8 flex flex-wrap items-center justify-between gap-3">
                    <h1 class="text-2xl font-semibold text-gray-950">
                        Gift Shop - Admin Page
                    </h1>
                    <a
                        class="text-sm font-medium text-blue-700 underline"
                        href="/"
                    >
                        View catalogue
                    </a>
                </header>

                <p
                    id="inventory-error"
                    class="mb-4 min-h-6 text-sm font-medium text-red-700"
                    role="alert"
                >
                    {error ?? ""}
                </p>

                <section class="mb-10 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-6">
                    <h2 class="mb-4 text-xl font-semibold text-gray-950">
                        Add inventory
                    </h2>
                    <form
                        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
                        method="post"
                        action="/api/inventory"
                        enctype="multipart/form-data"
                        hx-post="/api/inventory"
                        hx-encoding="multipart/form-data"
                        hx-target="#inventory-table-body"
                        hx-swap="beforeend"
                        data-reset-after-success
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
                        <label class="grid gap-1 text-sm font-medium text-gray-800">
                            Notes
                            <input class={inputClasses} name="adminNotes" />
                        </label>
                        <label class="grid gap-1 text-sm font-medium text-gray-800 sm:col-span-2 lg:col-span-5">
                            Take photo or choose image
                            <input
                                class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-2 file:font-medium"
                                type="file"
                                name="image"
                                accept="image/*"
                                data-image-input
                                data-image-preview="new-inventory-image-preview"
                            />
                        </label>
                        <img
                            id="new-inventory-image-preview"
                            class="hidden aspect-4/3 h-24 rounded-md object-cover sm:col-span-2 lg:col-span-5"
                            width="128"
                            height="96"
                            alt="Selected inventory image preview"
                        />
                        <button
                            class="w-full rounded-md bg-gray-950 px-4 py-2 font-medium text-white sm:w-fit"
                            type="submit"
                        >
                            Add
                        </button>
                    </form>
                </section>

                <section>
                    <h2 class="mb-4 text-xl font-semibold text-gray-950">
                        Inventory
                    </h2>
                    <div class="overflow-x-auto rounded-lg border border-gray-200">
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
                                        Notes
                                    </th>
                                    <th class="px-3 py-3" scope="col">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                id="inventory-table-body"
                                class="divide-y divide-gray-200"
                            >
                                {items.map((item) => (
                                    <InventoryRow item={item} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </BaseLayout>
    );
}
