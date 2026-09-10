import "dotenv/config";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const databaseFileName = process.env.DB_FILE_NAME;
const databaseSetupGuidance = "Run `bun run db:push` first.";

if (!databaseFileName?.trim()) {
    throw new Error("DB_FILE_NAME must be set to a non-blank database path.");
}

let sqlite: Database;
try {
    sqlite = new Database(databaseFileName, {
        readwrite: true,
        create: false,
    });
} catch (cause) {
    throw new Error(
        `Database at DB_FILE_NAME does not exist or cannot be opened. ${databaseSetupGuidance}`,
        { cause },
    );
}

export const db = drizzle({ client: sqlite });
export * from "./schema";
