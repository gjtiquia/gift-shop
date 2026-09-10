import { html, Html } from "@elysia/html";
import { formatPrice } from "../../utils";

export interface InventoryItem {
    id: number;
    name: string;
    priceCentsX10: number;
    quantity: number;
    imageId: number | null;
    adminNotes: string | null;
}

const tableInputClasses =
    "w-full min-w-32 rounded-md border border-gray-300 px-2 py-2 text-gray-900";

export function InventoryRow({ item }: { item: InventoryItem }) {
    const updateFormId = `update-inventory-${item.id}`;
    const previewId = `inventory-image-preview-${item.id}`;
    const currentImageId = `inventory-current-image-${item.id}`;
    const removeImageId = `remove-inventory-image-${item.id}`;

    return (
        <tr id={`inventory-${item.id}`} class="align-top">
            <td class="px-3 py-4 text-gray-600">{item.id}</td>
            <td class="px-3 py-4">
                <div class="grid w-40 gap-2">
                    {item.imageId !== null ? (
                        <img
                            id={currentImageId}
                            class="aspect-4/3 w-24 rounded-md bg-gray-100 object-cover"
                            src={`/api/images/${item.imageId}`}
                            width="128"
                            height="96"
                            loading="lazy"
                            alt={`${item.name} inventory image`}
                        />
                    ) : (
                        <span class="text-xs text-gray-500">No image</span>
                    )}
                    <img
                        id={previewId}
                        class="hidden aspect-4/3 w-24 rounded-md bg-gray-100 object-cover"
                        width="128"
                        height="96"
                        alt={`Selected image preview for ${item.name}`}
                    />
                    <label class="grid gap-1 text-xs font-medium text-gray-700">
                        {item.imageId === null ? "Add image" : "Replace image"}
                        <input
                            class="block w-full text-xs file:mb-1 file:rounded file:border-0 file:bg-gray-200 file:px-2 file:py-1"
                            form={updateFormId}
                            type="file"
                            name="image"
                            accept="image/*"
                            data-image-input
                            data-image-preview={previewId}
                            data-current-image={
                                item.imageId === null
                                    ? undefined
                                    : currentImageId
                            }
                            data-remove-image={
                                item.imageId === null
                                    ? undefined
                                    : removeImageId
                            }
                        />
                    </label>
                    {item.imageId !== null ? (
                        <label class="flex items-center gap-2 text-xs text-gray-700">
                            <input
                                id={removeImageId}
                                form={updateFormId}
                                type="checkbox"
                                name="removeImage"
                                value="1"
                                data-remove-image-control
                                data-current-image={currentImageId}
                            />
                            Remove image
                        </label>
                    ) : null}
                </div>
            </td>
            <td class="px-3 py-4">
                <input
                    class={tableInputClasses}
                    form={updateFormId}
                    name="name"
                    aria-label={`Name for inventory item ${item.id}`}
                    value={item.name}
                    required
                />
            </td>
            <td class="px-3 py-4">
                <input
                    class={tableInputClasses}
                    form={updateFormId}
                    name="price"
                    aria-label={`Price for inventory item ${item.id}`}
                    inputmode="decimal"
                    value={formatPrice(item.priceCentsX10)}
                    required
                />
            </td>
            <td class="px-3 py-4">
                <input
                    class="w-24 rounded-md border border-gray-300 px-2 py-2 text-gray-900"
                    form={updateFormId}
                    type="number"
                    name="quantity"
                    aria-label={`Quantity for inventory item ${item.id}`}
                    min="0"
                    step="1"
                    value={String(item.quantity)}
                    required
                />
            </td>
            <td class="px-3 py-4">
                <input
                    class={tableInputClasses}
                    form={updateFormId}
                    name="adminNotes"
                    aria-label={`Notes for inventory item ${item.id}`}
                    value={item.adminNotes ?? ""}
                />
            </td>
            <td class="px-3 py-4">
                <div class="flex min-w-28 flex-col gap-2">
                    <form
                        id={updateFormId}
                        method="post"
                        action={`/api/inventory/${item.id}`}
                        enctype="multipart/form-data"
                        hx-put={`/api/inventory/${item.id}`}
                        hx-encoding="multipart/form-data"
                        hx-target="closest tr"
                        hx-swap="outerHTML"
                    >
                        <button
                            class="w-full rounded-md bg-gray-950 px-3 py-2 font-medium text-white"
                            type="submit"
                        >
                            Save
                        </button>
                    </form>
                    <button
                        class="rounded-md border border-red-300 px-3 py-2 font-medium text-red-700"
                        type="button"
                        hx-delete={`/api/inventory/${item.id}`}
                        hx-target="closest tr"
                        hx-swap="delete"
                        hx-confirm="Delete this item?"
                    >
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    );
}
