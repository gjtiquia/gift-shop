import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { api } from "../index";
import { createAuthSession } from "../../auth/lucia";
import { imageDataDirectory, storeImage } from "../images/storage";
import { db, imagesTable, inventoryTable } from "../../db";
import { reconcileInventoryImageStorage } from "./service";

const app = new Elysia().use(api);
const { authSessionToken } = await createAuthSession("admin");
const authCookie = `auth_session=${encodeURIComponent(authSessionToken)}`;
const sameOriginHeaders = {
    cookie: authCookie,
    "HX-Request": "true",
    "Sec-Fetch-Site": "same-origin",
};

const now = new Date();
const items = await db
    .insert(inventoryTable)
    .values([
        {
            name: "First",
            priceCentsX10: 100,
            quantity: 1,
            hidden: false,
            createdAt: now,
            lastModifiedAt: now,
        },
        {
            name: "Second",
            priceCentsX10: 200,
            quantity: 2,
            hidden: false,
            createdAt: now,
            lastModifiedAt: now,
        },
    ])
    .returning();

function bulkForm(
    first: { name: string; price: string; quantity: string },
    second: { name: string; price: string; quantity: string },
) {
    const form = new FormData();
    for (const [item, values] of [
        [items[0]!, first],
        [items[1]!, second],
    ] as const) {
        form.append("inventoryId", String(item.id));
        form.set(`name.${item.id}`, values.name);
        form.set(`price.${item.id}`, values.price);
        form.set(`quantity.${item.id}`, values.quantity);
        form.set(`adminNotes.${item.id}`, "");
    }
    return form;
}

function bulkRequest(
    body: FormData,
    headers: Record<string, string> = sameOriginHeaders,
) {
    return app.handle(
        new Request("http://localhost/api/inventory/bulk", {
            method: "POST",
            headers,
            body,
        }),
    );
}

const unauthenticated = await bulkRequest(
    bulkForm(
        { name: "First", price: "1.00", quantity: "1" },
        { name: "Second", price: "2.00", quantity: "2" },
    ),
    { "HX-Request": "true", "Sec-Fetch-Site": "same-origin" },
);
assert.equal(unauthenticated.status, 401);
assert.equal(unauthenticated.headers.get("HX-Redirect"), "/admin/login");

const crossSite = await bulkRequest(
    bulkForm(
        { name: "First", price: "1.00", quantity: "1" },
        { name: "Second", price: "2.00", quantity: "2" },
    ),
    { ...sameOriginHeaders, "Sec-Fetch-Site": "cross-site" },
);
assert.equal(crossSite.status, 403);

const success = await bulkRequest(
    bulkForm(
        { name: "First updated", price: "3.25", quantity: "4" },
        { name: "Second updated", price: "4.50", quantity: "5" },
    ),
);
assert.equal(success.status, 200, await success.clone().text());
assert.equal(success.headers.get("HX-Trigger"), "inventory-saved");
assert.match(await success.text(), /id="inventory-table-body"/);
assert.deepEqual(
    (await db.select().from(inventoryTable)).map((item) => ({
        name: item.name,
        priceCentsX10: item.priceCentsX10,
        quantity: item.quantity,
    })),
    [
        { name: "First updated", priceCentsX10: 325, quantity: 4 },
        { name: "Second updated", priceCentsX10: 450, quantity: 5 },
    ],
);

const invalid = await bulkRequest(
    bulkForm(
        { name: "Must not persist", price: "8.00", quantity: "8" },
        { name: "Invalid", price: "-1.00", quantity: "2" },
    ),
);
assert.equal(invalid.status, 422);
assert.equal(invalid.headers.get("HX-Retarget"), "#inventory-error");
assert.equal(
    (
        await db
            .select()
            .from(inventoryTable)
            .where(eq(inventoryTable.id, items[0]!.id))
    )[0]?.name,
    "First updated",
);

const imageFilesBefore = new Set(
    await readdir(imageDataDirectory).catch(() => [] as string[]),
);
const imageRowsBefore = (await db.select().from(imagesTable)).length;
const invalidImageForm = bulkForm(
    { name: "Image must not persist", price: "3.25", quantity: "4" },
    { name: "Second updated", price: "4.50", quantity: "5" },
);
invalidImageForm.set(
    `image.${items[0]!.id}`,
    new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "valid.png",
    ),
);
invalidImageForm.set(
    `image.${items[1]!.id}`,
    new File(["not an image"], "invalid.png"),
);
const invalidImage = await bulkRequest(invalidImageForm);
assert.equal(invalidImage.status, 422);
assert.match(await invalidImage.text(), /JPEG, PNG, or WebP/);
assert.equal(
    (await db.select().from(inventoryTable))[0]?.name,
    "First updated",
);
assert.equal((await db.select().from(imagesTable)).length, imageRowsBefore);
assert.deepEqual(
    new Set(await readdir(imageDataDirectory).catch(() => [] as string[])),
    imageFilesBefore,
);

const recoveryDirectory = await mkdtemp(
    join(tmpdir(), "gift-shop-image-recovery-"),
);
try {
    const orphanedImage = await storeImage(
        new File(
            [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            "orphan.png",
        ),
        recoveryDirectory,
    );
    assert.deepEqual(await readdir(recoveryDirectory), [
        orphanedImage.filename,
    ]);

    await reconcileInventoryImageStorage(recoveryDirectory);

    assert.deepEqual(await readdir(recoveryDirectory), []);
} finally {
    await rm(recoveryDirectory, { recursive: true, force: true });
}

const transactionFailureFilesBefore = new Set(
    await readdir(imageDataDirectory).catch(() => [] as string[]),
);
const transactionFailureRowsBefore = await db.select().from(imagesTable);
const transactionFailureInventoryBefore = await db
    .select()
    .from(inventoryTable);
const transactionFailureForm = bulkForm(
    { name: "First transaction rollback", price: "5.00", quantity: "6" },
    { name: "Second transaction rollback", price: "6.00", quantity: "7" },
);
for (const item of items) {
    transactionFailureForm.set(
        `image.${item.id}`,
        new File(
            [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            `${item.id}.png`,
        ),
    );
}

db.$client.exec(`
    CREATE TRIGGER fail_second_inventory_update
    BEFORE UPDATE ON inventory_table
    WHEN OLD.id = ${items[1]!.id}
    BEGIN
        SELECT RAISE(ABORT, 'forced second update failure');
    END;
`);
let transactionFailure: Response;
try {
    transactionFailure = await bulkRequest(transactionFailureForm);
} finally {
    db.$client.exec("DROP TRIGGER fail_second_inventory_update");
}
assert.equal(transactionFailure.status, 500);
assert.deepEqual(
    await db.select().from(inventoryTable),
    transactionFailureInventoryBefore,
);
assert.deepEqual(
    await db.select().from(imagesTable),
    transactionFailureRowsBefore,
);
assert.deepEqual(
    new Set(await readdir(imageDataDirectory).catch(() => [] as string[])),
    transactionFailureFilesBefore,
);

const initialImagesForm = bulkForm(
    { name: "First initial image", price: "7.00", quantity: "8" },
    { name: "Second initial image", price: "8.00", quantity: "9" },
);
for (const item of items) {
    initialImagesForm.set(
        `image.${item.id}`,
        new File(
            [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            `${item.id}-initial.png`,
        ),
    );
}
const initialImagesResponse = await bulkRequest(initialImagesForm);
assert.equal(
    initialImagesResponse.status,
    200,
    await initialImagesResponse.clone().text(),
);
const initialImageRows = await db.select().from(imagesTable);
assert.equal(initialImageRows.length, 2);

const replacementImagesForm = bulkForm(
    { name: "First replacement image", price: "9.00", quantity: "10" },
    { name: "Second replacement image", price: "10.00", quantity: "11" },
);
for (const item of items) {
    replacementImagesForm.set(
        `image.${item.id}`,
        new File(
            [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            `${item.id}-replacement.png`,
        ),
    );
}
const replacementImagesResponse = await bulkRequest(replacementImagesForm);
assert.equal(
    replacementImagesResponse.status,
    200,
    await replacementImagesResponse.clone().text(),
);

const replacementItems = await db.select().from(inventoryTable);
const replacementImageRows = await db.select().from(imagesTable);
assert.equal(replacementImageRows.length, 2);
assert.ok(replacementItems.every((item) => item.imageId !== null));
assert.ok(
    replacementItems.every((item) =>
        replacementImageRows.some((image) => image.id === item.imageId),
    ),
);
const replacementFiles = new Set(
    await readdir(imageDataDirectory).catch(() => [] as string[]),
);
for (const image of initialImageRows) {
    assert.equal(
        replacementImageRows.some((candidate) => candidate.id === image.id),
        false,
    );
    assert.equal(replacementFiles.has(image.filename), false);
}
for (const image of replacementImageRows) {
    assert.equal(replacementFiles.has(image.filename), true);
}

for (const item of items) {
    const deletion = await app.handle(
        new Request(`http://localhost/api/inventory/${item.id}`, {
            method: "DELETE",
            headers: sameOriginHeaders,
        }),
    );
    assert.equal(deletion.status, 200);
}
assert.equal((await db.select().from(imagesTable)).length, 0);
const filesAfterCleanup = new Set(
    await readdir(imageDataDirectory).catch(() => [] as string[]),
);
for (const image of replacementImageRows) {
    assert.equal(filesAfterCleanup.has(image.filename), false);
}
