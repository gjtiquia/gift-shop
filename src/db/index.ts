import "dotenv/config";
import { Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { decodeSchemaValidationResult } from "./schema-validation-protocol";

const databaseFileName = process.env.DB_FILE_NAME;
const databaseSetupGuidance = "Run `bun run db:push` first.";
const schemaValidationTimeoutMs = 30_000;
const schemaValidationMaxOutputBytes = 1024 * 1024;

if (!databaseFileName?.trim()) {
    throw new Error("DB_FILE_NAME must be set to a non-blank database path.");
}

let inspectionDatabase: Database;
try {
    inspectionDatabase = new Database(databaseFileName, { readonly: true });
} catch (cause) {
    throw new Error(
        `Database at DB_FILE_NAME does not exist or cannot be opened. ${databaseSetupGuidance}`,
        { cause },
    );
}
inspectionDatabase.close();

const schemaValidationProcess = Bun.spawnSync(
    [
        process.execPath,
        fileURLToPath(new URL("./schema-validation-child.ts", import.meta.url)),
        databaseFileName,
        fileURLToPath(new URL("./schema.ts", import.meta.url)),
    ],
    {
        stdout: "pipe",
        stderr: "pipe",
        timeout: schemaValidationTimeoutMs,
        maxBuffer: schemaValidationMaxOutputBytes,
    },
);
const schemaValidation = decodeSchemaValidationResult(
    schemaValidationProcess.stdout.toString(),
);

if (schemaValidation?.outcome === "schema_mismatch") {
    throw new Error(
        `Database schema does not match src/db/schema.ts (${schemaValidation.detail}). ${databaseSetupGuidance}`,
    );
}

if (
    !schemaValidationProcess.success ||
    schemaValidation?.outcome !== "no_changes"
) {
    const stderr = schemaValidationProcess.stderr
        .toString()
        .trim()
        .slice(-2_000);
    const processFailure = schemaValidationProcess.exitedDueToTimeout
        ? `validator subprocess timed out after ${schemaValidationTimeoutMs}ms`
        : schemaValidationProcess.exitedDueToMaxBuffer
          ? `validator subprocess exceeded ${schemaValidationMaxOutputBytes} output bytes`
          : stderr ||
            `validator subprocess failed with exit code ${schemaValidationProcess.exitCode}`;
    const detail =
        schemaValidation?.outcome === "validation_error"
            ? schemaValidation.detail
            : processFailure;
    throw new Error(
        `Database schema could not be validated (${detail}). ${databaseSetupGuidance}`,
    );
}

const sqlite = new Database(databaseFileName, {
    readwrite: true,
    create: false,
});

export const db = drizzle({ client: sqlite });
export * from "./schema";
