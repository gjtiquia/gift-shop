import { html, Html } from "@elysia/html";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { formatPrice } from "../utils";
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

            {error ? <p style="color: red;">{error}</p> : <></>}

            <h2>Add inventory</h2>
            <form method="post" action="/api/inventory">
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
                <tbody>
                    {items.map((item) => {
                        const updateFormId = `update-inventory-${item.id}`;
                        return (
                            <tr>
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
                                        method="post"
                                        action={`/api/inventory/${item.id}`}
                                    >
                                        <button type="submit">Save</button>
                                    </form>
                                    <form
                                        method="post"
                                        action={`/api/inventory/${item.id}/delete`}
                                        onsubmit="return confirm('Delete this item?')"
                                    >
                                        <button type="submit">Delete</button>
                                    </form>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </BaseLayout>
    );
}
