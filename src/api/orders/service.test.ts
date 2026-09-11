import { expect, test } from "bun:test";
import { createTemporaryDatabase } from "../../test/tempDbForTests";

const runnerUrl = new URL("./service.testRunner.ts", import.meta.url);

test("order service enforces submission, transition, and inventory rules", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-orders-");
    try {
        const result = Bun.spawnSync([process.execPath, runnerUrl.pathname], {
            env: {
                ...process.env,
                DB_FILE_NAME: temporaryDatabase.databasePath,
            },
            stdout: "pipe",
            stderr: "pipe",
            timeout: 30_000,
            maxBuffer: 1024 * 1024,
        });
        const output = `${result.stderr.toString()}${result.stdout.toString()}`;
        expect(result.success, output).toBe(true);
        expect(output).toContain("ORDER_SERVICE_TESTS_PASSED");
    } finally {
        temporaryDatabase.cleanup();
    }
});
