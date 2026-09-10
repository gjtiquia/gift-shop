import { html, Html } from "@elysia/html";
import { formatPrice } from "../../utils";

export interface InventoryItem {
    id: number;
    name: string;
    priceCentsX10: number;
    quantity: number;
    adminNotes: string | null;
}

export function InventoryRow({ item }: { item: InventoryItem }) {
    const updateFormId = `update-inventory-${item.id}`;

    return (
        <tr id={`inventory-${item.id}`}>
            <td>{item.id}</td>
            <td>
                <input
                    form={updateFormId}
                    name="name"
                    value={item.name}
                    required
                />
            </td>
            <td>
                <input
                    form={updateFormId}
                    name="price"
                    inputmode="decimal"
                    value={formatPrice(item.priceCentsX10)}
                    required
                />
            </td>
            <td>
                <input
                    form={updateFormId}
                    type="number"
                    name="quantity"
                    min="0"
                    step="1"
                    value={String(item.quantity)}
                    required
                />
            </td>
            <td>
                <input
                    form={updateFormId}
                    name="adminNotes"
                    value={item.adminNotes ?? ""}
                />
            </td>
            <td>
                <form
                    id={updateFormId}
                    hx-put={`/api/inventory/${item.id}`}
                    hx-target="closest tr"
                    hx-swap="outerHTML"
                >
                    <button type="submit">Save</button>
                </form>
                <button
                    type="button"
                    hx-delete={`/api/inventory/${item.id}`}
                    hx-target="closest tr"
                    hx-swap="delete"
                    hx-confirm="Delete this item?"
                >
                    Delete
                </button>
            </td>
        </tr>
    );
}
