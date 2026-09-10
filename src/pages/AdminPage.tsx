import { html, Html } from "@elysia/html";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { InventoryRow } from "./components/InventoryRow";
import { BaseLayout } from "./layouts/BaseLayout";

interface AdminPageProps {
    error?: string;
}

export async function AdminPage({ error }: AdminPageProps = {}) {
    const items = await db
        .select()
        .from(inventoryTable)
        .orderBy(asc(inventoryTable.id));

    return (
        <BaseLayout>
            <h1>Gift Shop - Admin Page</h1>
            <p>
                <a href="/">View catalogue</a>
            </p>

            <p id="inventory-error" style="color: red;">
                {error ?? ""}
            </p>

            <h2>Add inventory</h2>
            <form
                method="post"
                action="/api/inventory"
                hx-post="/api/inventory"
                hx-target="#inventory-table-body"
                hx-swap="beforeend"
                hx-on--after-request="if (event.detail.successful) this.reset()"
            >
                <label>
                    Name <input name="name" required />
                </label>{" "}
                <label>
                    Price{" "}
                    <input
                        name="price"
                        inputmode="decimal"
                        placeholder="9.99"
                        required
                    />
                </label>{" "}
                <label>
                    Quantity{" "}
                    <input
                        type="number"
                        name="quantity"
                        min="0"
                        step="1"
                        required
                    />
                </label>{" "}
                <label>
                    Notes <input name="adminNotes" />
                </label>{" "}
                <button type="submit">Add</button>
            </form>

            <h2>Inventory</h2>
            <table>
                <thead>
                    <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Name</th>
                        <th scope="col">Price</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Notes</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody id="inventory-table-body">
                    {items.map((item) => (
                        <InventoryRow item={item} />
                    ))}
                </tbody>
            </table>
        </BaseLayout>
    );
}
