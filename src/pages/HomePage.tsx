import { html, Html } from "@elysia/html";
import { asc } from "drizzle-orm";
import { db, inventoryTable } from "../db";
import { formatPrice } from "../utils";
import { BaseLayout } from "./layouts/BaseLayout";

export async function HomePage() {
    const items = await db
        .select({
            name: inventoryTable.name,
            priceCentsX10: inventoryTable.priceCentsX10,
            quantity: inventoryTable.quantity,
        })
        .from(inventoryTable)
        .orderBy(asc(inventoryTable.id));

    return (
        <BaseLayout>
            <h1>Gift Shop - Catalogue</h1>
            <table>
                <thead>
                    <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Price</th>
                        <th scope="col">Availability</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr>
                            <td>{item.name}</td>
                            <td>{formatPrice(item.priceCentsX10)}</td>
                            <td>
                                {item.quantity === 0
                                    ? "Out of stock"
                                    : `${item.quantity} in stock`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseLayout>
    );
}
