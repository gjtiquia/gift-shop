import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    ImageValidationError,
    detectImageFormat,
    maximumImageSizeBytes,
    removeStoredImage,
    storedImagePath,
    storeImage,
} from "./storage";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

test("detectImageFormat recognizes only supported file signatures", () => {
    expect(detectImageFormat(jpeg)).toEqual({
        extension: "jpg",
        contentType: "image/jpeg",
    });
    expect(detectImageFormat(png)).toEqual({
        extension: "png",
        contentType: "image/png",
    });
    expect(detectImageFormat(webp)).toEqual({
        extension: "webp",
        contentType: "image/webp",
    });
    expect(
        detectImageFormat(new TextEncoder().encode("not an image")),
    ).toBeNull();
});

test("storeImage uses the detected format instead of client metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gift-shop-images-"));

    try {
        const file = new File([png], "misleading.jpg", { type: "image/jpeg" });
        const stored = await storeImage(file, directory);

        expect(stored.filename).toMatch(/^\d{13}-[0-9a-f]{16}\.png$/);
        expect(stored.format.contentType).toBe("image/png");
        expect(
            new Uint8Array(await readFile(join(directory, stored.filename))),
        ).toEqual(png);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("storeImage rejects unsupported and oversized files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gift-shop-images-"));

    try {
        await expect(
            storeImage(new Blob(["not an image"]), directory),
        ).rejects.toBeInstanceOf(ImageValidationError);
        await expect(
            storeImage(
                new Blob([new Uint8Array(maximumImageSizeBytes + 1)]),
                directory,
            ),
        ).rejects.toBeInstanceOf(ImageValidationError);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("removeStoredImage reports retryable filesystem failures", async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;
    try {
        expect(
            await removeStoredImage(
                "1700000000000-0123456789abcdef.webp",
                async () => {
                    throw Object.assign(new Error("permission denied"), {
                        code: "EACCES",
                    });
                },
            ),
        ).toBe(false);
    } finally {
        console.error = originalConsoleError;
    }
});

test("storedImagePath rejects client-controlled path shapes", () => {
    expect(storedImagePath("../secret.png")).toBeNull();
    expect(storedImagePath("inventory.png")).toBeNull();
    expect(
        storedImagePath("1700000000000-0123456789abcdef.webp", "/tmp/images"),
    ).toBe("/tmp/images/1700000000000-0123456789abcdef.webp");
});
