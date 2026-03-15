/**
 * AlphaFold API adapter — wraps alphafoldFetch into the ApiFetchFn interface
 * for use by the Code Mode __api_proxy tool.
 *
 * Must handle non-JSON responses (PDB/mmCIF text files) gracefully by
 * returning them as plain text strings.
 *
 * The catalog uses paths like:
 *   /prediction/{qualifier}
 *   /prediction/{qualifier}?key=pdb
 *   /prediction/{qualifier}?key=pae
 *   /uniprot/summary/{accession}.json
 *   /search?query={text}
 *   /stats
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { alphafoldFetch } from "./http";

/**
 * Create an ApiFetchFn that routes through the AlphaFold DB API.
 * No auth needed — AlphaFold DB is open access.
 */
export function createAlphafoldApiFetch(): ApiFetchFn {
    return async (request) => {
        const response = await alphafoldFetch(
            request.path,
            request.params as Record<string, unknown>,
        );

        if (!response.ok) {
            let errorBody: string;
            try {
                errorBody = await response.text();
            } catch {
                errorBody = response.statusText;
            }
            const error = new Error(
                `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
            ) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";

        // PDB and mmCIF responses are text, not JSON
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
