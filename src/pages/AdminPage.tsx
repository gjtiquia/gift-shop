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
            <main class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header class="flex flex-wrap items-center justify-between gap-3">
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
                    class="min-h-6 text-sm font-medium text-red-700"
                    role="alert"
                >
                    {error ?? ""}
                </p>

                <section class="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-6">
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

                <section
                    id="inventory-section"
                    class="grid gap-4"
                    data-js-inventoryEditor
                >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <h2 class="text-xl font-semibold text-gray-950">
                            Inventory
                        </h2>
                        <div class="flex flex-wrap gap-2">
                            <button
                                id="inventory-edit"
                                class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                                type="button"
                            >
                                Edit
                            </button>
                            <button
                                id="inventory-save"
                                class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white"
                                type="button"
                                hidden
                            >
                                Save changes
                            </button>
                            <button
                                id="inventory-discard"
                                class="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800"
                                type="button"
                                hidden
                            >
                                Discard changes
                            </button>
                        </div>
                    </div>
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
                                    <th
                                        class="px-3 py-3"
                                        scope="col"
                                        data-inventory-edit-only
                                        hidden
                                    >
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
