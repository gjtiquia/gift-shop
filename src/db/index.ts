import "dotenv/config";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";

// TODO : should throw if env doesnt exist
// TODO : should throw if db doesnt exist and asks to run "bun run db:push"
// TODO : should throw if db schema doesnt match code schema

export const db = drizzle(process.env.DB_FILE_NAME!);
export * from "./schema";
