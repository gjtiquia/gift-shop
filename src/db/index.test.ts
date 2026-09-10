import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTemporaryDatabase } from "../test/tempDbForTests";

const databaseModuleUrl = new URL("./index.ts", import.meta.url).href;

function runDatabaseModule(
    databaseFileName: string | undefined,
    workingDirectory = process.cwd(),
) {
    const env = { ...process.env };
    delete env.DB_FILE_NAME;
    if (databaseFileName !== undefined) env.DB_FILE_NAME = databaseFileName;

    const result = Bun.spawnSync(
        [
            process.execPath,
            "-e",
            `
                await import(${JSON.stringify(databaseModuleUrl)});
                console.log("DATABASE_OPENED");
            `,
        ],
        {
            cwd: workingDirectory,
            env,
            stdout: "pipe",
            stderr: "pipe",
            timeout: 30_000,
            maxBuffer: 1024 * 1024,
        },
    );

    return {
        ...result,
        output: `${result.stderr.toString()}${result.stdout.toString()}`,
    };
}

test("database startup rejects a missing DB_FILE_NAME", () => {
    const directory = mkdtempSync(join(tmpdir(), "gift-shop-db-no-env-"));

    try {
        const result = runDatabaseModule(undefined, directory);

        expect(result.success).toBe(false);
        expect(result.output).toContain("DB_FILE_NAME must be set");
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup rejects a nonexistent database without creating it", () => {
    const directory = mkdtempSync(join(tmpdir(), "gift-shop-db-missing-"));
    const databasePath = join(directory, "missing.sqlite");

    try {
        const result = runDatabaseModule(databasePath);

        expect(result.success).toBe(false);
        expect(result.output).toContain("Database does not exist");
        expect(result.output).toContain("bun run db:push");
        expect(existsSync(databasePath)).toBe(false);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup rejects an out-of-sync schema", () => {
    const directory = mkdtempSync(join(tmpdir(), "gift-shop-db-schema-"));
    const databasePath = join(directory, "empty.sqlite");
    new Database(databasePath).close();

    try {
        const result = runDatabaseModule(databasePath);

        expect(result.success).toBe(false);
        expect(result.output).toContain("Database schema is out of sync");
        expect(result.output).toContain("bun run db:push");
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup accepts an in-sync schema", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-db-valid-");

    try {
        const result = runDatabaseModule(temporaryDatabase.databasePath);

        expect(result.success).toBe(true);
        expect(result.output).toContain("DATABASE_OPENED");
    } finally {
        temporaryDatabase.cleanup();
    }
});
