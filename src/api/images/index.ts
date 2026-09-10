import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db, imagesTable, inventoryTable } from "../../db";
import { detectImageFormat, storedImagePath } from "./storage";

export const images = new Elysia({ prefix: "images" }).get(
    "/:id",
    async ({ params }) => {
        const id = parseImageId(params.id);
        if (id === null) return imageNotFoundResponse();

        const [image] = await db
            .select({ filename: imagesTable.filename })
            .from(imagesTable)
            .innerJoin(
                inventoryTable,
                eq(inventoryTable.imageId, imagesTable.id),
            )
            .where(eq(imagesTable.id, id))
            .limit(1);
        if (!image) return imageNotFoundResponse();

        const path = storedImagePath(image.filename);
        if (!path) return imageNotFoundResponse();

        const file = Bun.file(path);
        if (!(await file.exists())) return imageNotFoundResponse();

        const format = detectImageFormat(
            new Uint8Array(await file.slice(0, 12).arrayBuffer()),
        );
        if (!format || !image.filename.endsWith(`.${format.extension}`)) {
            return imageNotFoundResponse();
        }

        return new Response(file, {
            headers: {
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Type": format.contentType,
                "X-Content-Type-Options": "nosniff",
            },
        });
    },
);

function parseImageId(value: string) {
    if (!/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function imageNotFoundResponse() {
    return new Response("Image not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
    });
}
