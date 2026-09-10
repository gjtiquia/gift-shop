import { push } from "drizzle-kit/cli";
import { encodeSchemaValidationResult } from "./schema-validation-protocol";

const [, , databaseFileName, schemaPath] = Bun.argv;

function report(result: Parameters<typeof encodeSchemaValidationResult>[0]) {
    console.log(encodeSchemaValidationResult(result));
}

function describeError(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return detail.slice(0, 2_000);
}

if (!databaseFileName || !schemaPath) {
    report({
        outcome: "validation_error",
        detail: "The schema validator requires database and schema paths.",
    });
    process.exit(1);
}

try {
    const result = await push({
        dialect: "sqlite",
        schema: schemaPath,
        url: databaseFileName,
        explain: true,
    });

    if (result.status === "no_changes") {
        report({ outcome: "no_changes" });
    } else if (result.status === "error") {
        report({
            outcome: "validation_error",
            detail: result.error.message || result.error.code,
        });
        process.exitCode = 1;
    } else {
        report({ outcome: "schema_mismatch", detail: result.status });
        process.exitCode = 2;
    }
} catch (cause) {
    report({ outcome: "validation_error", detail: describeError(cause) });
    process.exitCode = 1;
}
