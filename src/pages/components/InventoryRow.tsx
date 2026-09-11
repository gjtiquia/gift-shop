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
    const imagePreviewId = `inventory-image-preview-${item.id}`;
    const imageFilenameId = `inventory-image-filename-${item.id}`;
    const noImageId = `inventory-no-image-${item.id}`;

    return (
        <tr id={`inventory-${item.id}`} class="align-top">
            <td class="px-3 py-4 text-gray-600">{item.id}</td>
            <td class="px-3 py-4">
                <div class="grid w-40 gap-2">
                    <img
                        id={imagePreviewId}
                        class="aspect-4/3 w-24 rounded-md bg-gray-100 object-cover"
                        src={
                            item.imageId !== null
                                ? `/api/images/${item.imageId}`
                                : undefined
                        }
                        data-original-src={
                            item.imageId !== null
                                ? `/api/images/${item.imageId}`
                                : ""
                        }
                        width="128"
                        height="96"
                        loading="lazy"
                        alt={`${item.name} inventory image`}
                        hidden={item.imageId === null}
                    />
                    <span
                        id={noImageId}
                        class="text-xs text-gray-500"
                        hidden={item.imageId !== null}
                    >
                        No image
                    </span>
                    <label
                        class="grid gap-1 text-xs font-medium text-gray-700"
                        data-inventory-edit-only
                        hidden
                    >
                        {item.imageId === null
                            ? "Add image (optional)"
                            : "Replace image (optional)"}
                        <input
                            class="block w-full text-xs file:mb-1 file:rounded file:border-0 file:bg-gray-200 file:px-2 file:py-1"
                            form={updateFormId}
                            type="file"
                            name="image"
                            accept="image/jpeg,image/png,image/webp"
                            data-image-preview={imagePreviewId}
                            data-image-filename={imageFilenameId}
                            data-image-empty={noImageId}
                            disabled
                        />
                        <span
                            id={imageFilenameId}
                            class="font-normal text-gray-600"
                            aria-live="polite"
                        ></span>
                    </label>
                </div>
            </td>
            <td class="px-3 py-4">
                <input
                    class={tableInputClasses}
                    form={updateFormId}
                    name="name"
                    aria-label={`Name for inventory item ${item.id}`}
                    value={item.name}
                    data-inventory-field
                    readonly
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
                    data-inventory-field
                    readonly
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
                    data-inventory-field
                    readonly
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
                    data-inventory-field
                    readonly
                />
            </td>
            <td class="px-3 py-4" data-inventory-edit-only hidden>
                <div>
                    <form
                        id={updateFormId}
                        method="post"
                        action={`/api/inventory/${item.id}`}
                        enctype="multipart/form-data"
                        data-inventory-update-form
                    ></form>
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
