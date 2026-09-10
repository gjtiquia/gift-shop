import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export type TemporaryDatabase = {
    databasePath: string;
    directoryPath: string;
    cleanup: () => void;
};

export function createTemporaryDatabase(prefix: string): TemporaryDatabase {
    const directoryPath = mkdtempSync(join(tmpdir(), prefix));
    const databasePath = join(directoryPath, "test.sqlite");
    const result = Bun.spawnSync([process.execPath, "run", "db:push"], {
        cwd: repositoryRoot,
        env: { ...process.env, DB_FILE_NAME: databasePath },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
    });

    if (!result.success) {
        rmSync(directoryPath, { recursive: true, force: true });
        throw new Error(
            `Could not create temporary database with bun run db:push:\n${result.stderr.toString()}${result.stdout.toString()}`,
        );
    }

    return {
        databasePath,
        directoryPath,
        cleanup: () => rmSync(directoryPath, { recursive: true, force: true }),
    };
}
