/**
 * AlphaFold DB HTTP client.
 *
 * Wraps restFetch with the AlphaFold EBI API base URL.
 * No authentication required — open access.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const ALPHAFOLD_BASE = "https://alphafold.ebi.ac.uk/api";

export interface AlphafoldFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    /** Override base URL */
    baseUrl?: string;
}

/**
 * Fetch from the AlphaFold DB API.
 */
export async function alphafoldFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: AlphafoldFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? ALPHAFOLD_BASE;
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts?.headers ?? {}),
    };

    return restFetch(baseUrl, path, params, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent:
            "alphafold-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/alphafold-mcp-server)",
    });
}
