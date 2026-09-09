import { html, Html } from "@elysia/html";
import { BaseLayout } from "./layouts/BaseLayout";

export function HomePage() {
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
                    <tr>
                        <th>image</th>
                        <th>name</th>
                        <th>price</th>
                    </tr>
                    <tr>
                        <th>image</th>
                        <th>name</th>
                        <th>price</th>
                    </tr>
                    <tr>
                        <th>image</th>
                        <th>name</th>
                        <th>price</th>
                    </tr>
                    <tr>
                        <th>image</th>
                        <th>name</th>
                        <th>price</th>
                    </tr>
                </tbody>
            </table>
        </BaseLayout>
    );
}
