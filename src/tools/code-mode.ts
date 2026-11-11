/**
 * AlphaFold Code Mode — registers search + execute tools for full API access.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { alphafoldCatalog } from "../spec/catalog";
import { createAlphafoldApiFetch } from "../lib/api-adapter";

interface CodeModeEnv {
    ALPHAFOLD_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
}

/**
 * Register alphafolddb_search and alphafolddb_execute tools.
 */
export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createAlphafoldApiFetch();
    const registrar = {tool: (...args: unknown[]) => {
        const [name, ...rest] = args;
        const register = server.tool.bind(server) as (...values: unknown[]) => void;
        register(name, ...rest); register(`mcp_${String(name)}`, ...rest);
    }};

    // Register the search tool (in-process, no isolate)
    const searchTool = createSearchTool({
        prefix: "alphafolddb",
        catalog: alphafoldCatalog,
    });
    searchTool.register(registrar);

    // Register the execute tool (V8 isolate via DynamicWorkerExecutor)
    const executeTool = createExecuteTool({
        prefix: "alphafolddb",
        // Verifiable provenance: alphafolddb_execute results carry a _meta.citation.
        source: { id: "alphafolddb", name: "AlphaFold Protein Structure Database", url: "https://alphafold.ebi.ac.uk", license: "CC BY 4.0" },
        catalog: alphafoldCatalog,
        apiFetch,
        maxInlineBytes: 30 * 1024,
        timeout: 60000,
        doNamespace: env.ALPHAFOLD_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrar);
}
