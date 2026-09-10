import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTemporaryDatabase } from "../test/database";

const databaseModuleUrl = new URL("./index.ts", import.meta.url).href;

function runDatabaseModule(
    databaseFileName: string | undefined,
    workingDirectory: string,
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
                const stringExtensions = [
                    "trimChar",
                    "squashSpaces",
                    "camelCase",
                    "capitalise",
                    "concatIf",
                    "snake_case",
                ];
                const hasStringExtension = stringExtensions.some((name) =>
                    Object.prototype.hasOwnProperty.call(String.prototype, name),
                );
                const hasArrayExtension = Object.prototype.hasOwnProperty.call(
                    Array.prototype,
                    "random",
                );
                if (hasStringExtension || hasArrayExtension) {
                    throw new Error("Database startup polluted native prototypes");
                }
                console.log("NATIVE_PROTOTYPES_CLEAN");
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

function createWorkingDirectory() {
    return mkdtempSync(join(tmpdir(), "gift-shop-db-startup-"));
}

test("database startup rejects a missing DB_FILE_NAME", () => {
    const directory = createWorkingDirectory();
    try {
        const result = runDatabaseModule(undefined, directory);

        expect(result.success).toBe(false);
        expect(result.output).toContain("DB_FILE_NAME must be set");
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup rejects blank DB_FILE_NAME values", () => {
    const directory = createWorkingDirectory();
    try {
        for (const value of ["", "   "]) {
            const result = runDatabaseModule(value, directory);

            expect(result.success).toBe(false);
            expect(result.output).toContain("DB_FILE_NAME must be set");
        }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup rejects a nonexistent database without creating it", () => {
    const directory = createWorkingDirectory();
    const databasePath = join(directory, "missing.sqlite");
    try {
        const result = runDatabaseModule(databasePath, directory);

        expect(result.success).toBe(false);
        expect(result.output).toContain("does not exist or cannot be opened");
        expect(result.output).toContain("bun run db:push");
        expect(existsSync(databasePath)).toBe(false);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup rejects an empty database", () => {
    const directory = createWorkingDirectory();
    const databasePath = join(directory, "empty.sqlite");
    const sqlite = new Database(databasePath);
    sqlite.close();

    try {
        const result = runDatabaseModule(databasePath, directory);

        expect(result.success).toBe(false);
        expect(result.output).toContain(
            "Database schema does not match src/db/schema.ts",
        );
        expect(result.output).toContain("bun run db:push");
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("database startup accepts a fresh complete database", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-db-valid-");
    try {
        const result = runDatabaseModule(
            temporaryDatabase.databasePath,
            temporaryDatabase.directoryPath,
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain("NATIVE_PROTOTYPES_CLEAN");
    } finally {
        temporaryDatabase.cleanup();
    }
});

test("database startup detects missing schema tables", () => {
    const temporaryDatabase = createTemporaryDatabase(
        "gift-shop-db-missing-table-",
    );

    try {
        const sqlite = new Database(temporaryDatabase.databasePath);
        sqlite.exec("DROP TABLE orders_table");
        sqlite.close();

        const result = runDatabaseModule(
            temporaryDatabase.databasePath,
            temporaryDatabase.directoryPath,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain(
            "Database schema does not match src/db/schema.ts",
        );
        expect(result.output).toContain("bun run db:push");
    } finally {
        temporaryDatabase.cleanup();
    }
});

test("database startup detects extra schema columns", () => {
    const temporaryDatabase = createTemporaryDatabase(
        "gift-shop-db-extra-column-",
    );

    try {
        const sqlite = new Database(temporaryDatabase.databasePath);
        sqlite.exec("ALTER TABLE inventory_table ADD COLUMN unexpected TEXT");
        sqlite.close();

        const result = runDatabaseModule(
            temporaryDatabase.databasePath,
            temporaryDatabase.directoryPath,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain(
            "Database schema does not match src/db/schema.ts",
        );
        expect(result.output).toContain("bun run db:push");
    } finally {
        temporaryDatabase.cleanup();
    }
});

test("database startup detects foreign-key drift in a populated table", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-db-fk-");

    try {
        const sqlite = new Database(temporaryDatabase.databasePath);
        sqlite.exec(`
            INSERT INTO inventory_table (
                name, priceCentsX10, quantity, createdAt, lastModifiedAt
            ) VALUES ('Gift', 100, 1, 0, 0);
            INSERT INTO order_items_table (
                inventoryId, quantity, createdAt, lastModifiedAt
            ) VALUES (1, 1, 0, 0);
        `);
        const row = sqlite
            .query<{ sql: string | null }, []>(
                "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'order_items_table'",
            )
            .get();
        if (!row?.sql) throw new Error("order_items_table DDL was not found");

        const withoutForeignKey = row.sql.replace(
            /,\n\s*CONSTRAINT `[^`]+` FOREIGN KEY \(`inventoryId`\) REFERENCES `inventory_table`\(`id`\)/,
            "",
        );
        if (withoutForeignKey === row.sql) {
            throw new Error("order_items_table foreign key was not found");
        }

        sqlite.exec("ALTER TABLE order_items_table RENAME TO order_items_old");
        sqlite.exec(withoutForeignKey);
        sqlite.exec(`
            INSERT INTO order_items_table SELECT * FROM order_items_old;
            DROP TABLE order_items_old;
        `);
        expect(
            sqlite.query("PRAGMA foreign_key_list(order_items_table)").all(),
        ).toHaveLength(0);
        expect(
            sqlite
                .query<{ count: number }, []>(
                    "SELECT COUNT(*) AS count FROM order_items_table",
                )
                .get()?.count,
        ).toBe(1);
        sqlite.close();

        const result = runDatabaseModule(
            temporaryDatabase.databasePath,
            temporaryDatabase.directoryPath,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain(
            "Database schema does not match src/db/schema.ts",
        );
        expect(result.output).toContain("bun run db:push");
    } finally {
        temporaryDatabase.cleanup();
    }
});

test("database startup rejects missing hints for populated NOT NULL drift", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-db-not-null-");

    try {
        const sqlite = new Database(temporaryDatabase.databasePath);
        sqlite.exec(`
            INSERT INTO orders_table (
                customerName, fulfilled, createdAt, lastModifiedAt
            ) VALUES ('Customer', 0, 0, 0);
            ALTER TABLE orders_table DROP COLUMN customerName;
        `);
        sqlite.close();

        const result = runDatabaseModule(
            temporaryDatabase.databasePath,
            temporaryDatabase.directoryPath,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain(
            "Database schema does not match src/db/schema.ts (missing_hints)",
        );
        expect(result.output).toContain("bun run db:push");
    } finally {
        temporaryDatabase.cleanup();
    }
});

test("database startup detects unexpected indexes", () => {
    const temporaryDatabase = createTemporaryDatabase("gift-shop-db-index-");

    try {
        const sqlite = new Database(temporaryDatabase.databasePath);
        sqlite.exec(
            "CREATE INDEX unexpected_inventory_name_idx ON inventory_table(name)",
        );
        sqlite.close();

        const result = runDatabaseModule(
            temporaryDatabase.databasePath,
            temporaryDatabase.directoryPath,
        );

        expect(result.success).toBe(false);
        expect(result.output).toContain(
            "Database schema does not match src/db/schema.ts",
        );
        expect(result.output).toContain("bun run db:push");
    } finally {
        temporaryDatabase.cleanup();
    }
});
