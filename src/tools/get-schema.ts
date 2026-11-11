import type { McpServer } from "@bio-mcp/shared/mcp";
import { z } from "zod";
import { createGetSchemaHandler } from "@bio-mcp/shared/staging/utils";
import {alphafoldResponse, type AlphafoldDataEnv} from "../lib/tool-result";

type SchemaEnv = AlphafoldDataEnv;

export function registerGetSchema(server: McpServer, env?: SchemaEnv): void {
    const handler = createGetSchemaHandler("ALPHAFOLD_DATA_DO", "alphafolddb");

    for (const name of ["alphafolddb_get_schema", "mcp_alphafolddb_get_schema"]) server.registerTool(
        name,
        {
            title: "Get Staged AlphaFold DB Schema",
            description:
                "Get schema information for staged AlphaFold DB data. Shows table structures and row counts. " +
                "If called without a data_access_id, lists all staged datasets available in this session.",
            inputSchema: {
                data_access_id: z
                    .string()
                    .min(1)
                    .optional()
                    .describe(
                        "Data access ID for the staged dataset. If omitted, lists all staged datasets in this session.",
                    ),
            },
        },
        async (args, extra) => {
            const runtimeEnv =
                env || (extra as { env?: SchemaEnv })?.env || {};
            return alphafoldResponse(() => handler(
                args as Record<string, unknown>,
                runtimeEnv as Record<string, unknown>,
                (extra as Record<string, unknown>),
            ), runtimeEnv, "alphafolddb_get_schema", extra);
        },
    );
}
