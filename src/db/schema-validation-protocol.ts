export const schemaValidationResultPrefix =
    "__GIFT_SHOP_DB_SCHEMA_VALIDATION__";

export type SchemaValidationResult =
    | { outcome: "no_changes" }
    | { outcome: "schema_mismatch"; detail: string }
    | { outcome: "validation_error"; detail: string };

export function encodeSchemaValidationResult(result: SchemaValidationResult) {
    return `${schemaValidationResultPrefix}${JSON.stringify(result)}`;
}

export function decodeSchemaValidationResult(
    output: string,
): SchemaValidationResult | undefined {
    const lines = output.split("\n");

    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        if (!line?.startsWith(schemaValidationResultPrefix)) continue;

        try {
            const result: unknown = JSON.parse(
                line.slice(schemaValidationResultPrefix.length),
            );
            if (
                !result ||
                typeof result !== "object" ||
                !("outcome" in result)
            ) {
                return undefined;
            }

            if (result.outcome === "no_changes")
                return { outcome: "no_changes" };
            if (
                (result.outcome === "schema_mismatch" ||
                    result.outcome === "validation_error") &&
                "detail" in result &&
                typeof result.detail === "string"
            ) {
                return { outcome: result.outcome, detail: result.detail };
            }
        } catch {
            return undefined;
        }
    }

    return undefined;
}
