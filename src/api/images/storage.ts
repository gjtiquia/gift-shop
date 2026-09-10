import { mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const maximumImageSizeBytes = 5 * 1024 * 1024;
export const imageDataDirectory = fileURLToPath(
    new URL("../../../data/", import.meta.url),
);

const storedImageFilenamePattern = /^\d{13}-[0-9a-f]{16}\.(?:jpg|png|webp)$/;

export type ImageFormat = {
    extension: "jpg" | "png" | "webp";
    contentType: "image/jpeg" | "image/png" | "image/webp";
};

export class ImageValidationError extends Error {}

export async function storeImage(
    file: Blob,
    directory = imageDataDirectory,
): Promise<{ filename: string; format: ImageFormat }> {
    if (file.size === 0) {
        throw new ImageValidationError("Choose a non-empty image.");
    }
    if (file.size > maximumImageSizeBytes) {
        throw new ImageValidationError("Images must be 5 MB or smaller.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = detectImageFormat(bytes);
    if (!format) {
        throw new ImageValidationError(
            "Images must be valid JPEG, PNG, or WebP files.",
        );
    }

    await mkdir(directory, { recursive: true });

    for (let attempt = 0; attempt < 5; attempt++) {
        const randomSuffix = Array.from(
            crypto.getRandomValues(new Uint8Array(8)),
            (value) => value.toString(16).padStart(2, "0"),
        ).join("");
        const filename = `${Date.now()}-${randomSuffix}.${format.extension}`;
        const path = join(directory, filename);

        let createdFile = false;
        try {
            const handle = await open(path, "wx");
            createdFile = true;
            try {
                await handle.writeFile(bytes);
            } finally {
                await handle.close();
            }
            return { filename, format };
        } catch (error) {
            if (createdFile) {
                await unlink(path).catch(() => undefined);
            }
            if (
                error instanceof Error &&
                "code" in error &&
                error.code === "EEXIST"
            ) {
                continue;
            }
            throw error;
        }
    }

    throw new Error("Could not generate a unique image filename.");
}

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) {
        return { extension: "jpg", contentType: "image/jpeg" };
    }

    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (
        bytes.length >= pngSignature.length &&
        pngSignature.every((byte, index) => bytes[index] === byte)
    ) {
        return { extension: "png", contentType: "image/png" };
    }

    if (
        bytes.length >= 12 &&
        asciiAt(bytes, 0, "RIFF") &&
        asciiAt(bytes, 8, "WEBP")
    ) {
        return { extension: "webp", contentType: "image/webp" };
    }

    return null;
}

export function storedImagePath(
    filename: string,
    directory = imageDataDirectory,
) {
    if (!storedImageFilenamePattern.test(filename)) return null;
    return join(directory, filename);
}

export async function removeStoredImage(
    filename: string,
    removeFile: (path: string) => Promise<void> = unlink,
) {
    const path = storedImagePath(filename);
    if (!path) return false;

    try {
        await removeFile(path);
        return true;
    } catch (error) {
        if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
        ) {
            return true;
        }

        console.error(`Could not remove inventory image ${filename}.`, error);
        return false;
    }
}

function asciiAt(bytes: Uint8Array, offset: number, expected: string) {
    return Array.from(expected).every(
        (character, index) => bytes[offset + index] === character.charCodeAt(0),
    );
}
