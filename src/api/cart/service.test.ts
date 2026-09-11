import { expect, test } from "bun:test";
import { spawnSync } from "bun";
import { fileURLToPath } from "node:url";
import { createTemporaryDatabase } from "../../test/tempDbForTests";

const testRunnerPath = fileURLToPath(
    new URL("./cart.testRunner.ts", import.meta.url),
);

test("anonymous visitor carts are server-owned and checkout is scoped and idempotent", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-cart-");
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
