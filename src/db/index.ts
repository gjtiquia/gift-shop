import "dotenv/config";
import { fileURLToPath } from "node:url";
import { push } from "drizzle-kit/cli";
import { drizzle } from "drizzle-orm/bun-sqlite";

const databaseFileName = process.env.DB_FILE_NAME;

if (!databaseFileName?.trim()) {
    throw new Error("DB_FILE_NAME must be set.");
}

if (!(await Bun.file(databaseFileName).exists())) {
    throw new Error("Database does not exist. Run `bun run db:push` first.");
}

const schemaValidation = await push({
    dialect: "sqlite",
    schema: fileURLToPath(new URL("./schema.ts", import.meta.url)),
    url: databaseFileName,
    explain: true,
});

if (schemaValidation.status !== "no_changes") {
    throw new Error(
        "Database schema is out of sync. Run `bun run db:push` first.",
    );
}

export const db = drizzle(databaseFileName);
export * from "./schema";
