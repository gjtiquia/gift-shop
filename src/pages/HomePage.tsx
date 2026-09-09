import { html, Html } from "@elysia/html";
import { BaseLayout } from "./layouts/BaseLayout";
import { db, imagesTable, inventoryTable } from "../db";
import { eq } from "drizzle-orm";

export async function HomePage() {
    // TODO : refactor into inventory service
    const items = await db
        .select({
            imageFilename: imagesTable.filename,
            name: inventoryTable.name,
            priceCentsX10: inventoryTable.priceCentsX10,
        })
        .from(inventoryTable)
        .leftJoin(imagesTable, eq(inventoryTable.imageId, imagesTable.id));

    return (
        <BaseLayout>
            <h1>Gift Shop - Catalogue</h1>
            <table>
                <thead>
                    <tr>
                        <th scope="col">Image</th>
                        <th scope="col">Name</th>
                        <th scope="col">Price</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr>
                            <th>{item.imageFilename}</th>
                            <th>{item.name}</th>
                            <th>{item.priceCentsX10 / 10}</th>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseLayout>
    );
}
