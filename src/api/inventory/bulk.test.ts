import { expect, test } from "bun:test";
import { spawnSync } from "bun";
import { fileURLToPath } from "node:url";
import { createTemporaryDatabase } from "../../test/tempDbForTests";

const testRunnerPath = fileURLToPath(
    new URL("./bulk.testRunner.ts", import.meta.url),
);

test("bulk inventory updates are authorized, atomic, and clean staged images", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-inventory-");
    try {
        const result = spawnSync([process.execPath, "run", testRunnerPath], {
            env: {
                ...process.env,
                DB_FILE_NAME: temporaryDatabase.databasePath,
            },
            stdout: "pipe",
            stderr: "pipe",
            timeout: 30_000,
        });

        expect(`${result.stderr.toString()}${result.stdout.toString()}`).toBe(
            "",
        );
        expect(result.success).toBe(true);
    } finally {
        temporaryDatabase.cleanup();
    }
});
