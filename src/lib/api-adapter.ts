/**
 * AlphaFold API adapter — wraps alphafoldFetch into the ApiFetchFn interface
 * for use by the Code Mode __api_proxy tool.
 *
 * Must handle non-JSON responses (PDB/mmCIF text files) gracefully by
 * returning them as plain text strings.
 *
 * The catalog uses paths like:
 *   /prediction/{qualifier}
 *   /uniprot/summary/{accession}.json
 *   /complex/{qualifier}
 *   /search with q/type query parameters
 *   POST /sequence/search/ and /sequence/filtered-entries
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { alphafoldFetch } from "./http";
import { readAlphafoldBody } from "./response-body";

function requestOptions(request: Parameters<ApiFetchFn>[0]) {
    if (request.method === "GET" && request.body === undefined) return {method: "GET"};
    if (request.method !== "POST" || !["/sequence/search/", "/sequence/filtered-entries"].includes(request.path)) {
        throw Object.assign(new Error("Use body-free GET or the cataloged sequence POST routes"), {status: 400});
    }
    let body: string | undefined;
    try { body = request.body === undefined ? undefined : JSON.stringify(request.body); }
    catch { throw Object.assign(new Error("AlphaFold POST body must be JSON serializable"), {status: 400}); }
    if (body && new TextEncoder().encode(body).length > 256 * 1024) throw Object.assign(new Error("AlphaFold POST body exceeds 256 KiB"), {status: 400});
    // A timed-out submission may already have created a job; never replay POST.
    return {method: "POST", body, headers: {"Content-Type": "application/json"}, retries: 0};
}

/**
 * Create an ApiFetchFn that routes through the AlphaFold DB API.
 * No auth needed — AlphaFold DB is open access.
 */
export function createAlphafoldApiFetch(): ApiFetchFn {
    return async (request) => {
        const opts = requestOptions(request);
        const submission = request.method === "POST" && request.path === "/sequence/search/";
        let response: Response;
        try {
            response = await alphafoldFetch(request.path, request.params, opts);
        } catch {
            throw Object.assign(new Error("AlphaFold request failed; do not automatically resubmit a sequence search"),
                {status: 502, data: {incomplete: true, submission_state_unknown: submission}});
        }
        let text: string;
        try { text = await readAlphafoldBody(response); }
        catch (cause) {
            throw Object.assign(new Error(cause instanceof Error ? cause.message : "AlphaFold response unreadable"),
                {status: response.ok ? 502 : response.status, data: {incomplete: true, body_complete: false,
                    http_status: response.status, submission_state_unknown: submission}});
        }

        if (!response.ok) {
            const error = new Error(
                `HTTP ${response.status}: ${text.slice(0, 200)}`,
            ) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = submission ? {native_text: text, http_status: response.status, retry_after: response.headers.get("Retry-After"), submission_state_unknown: true, incomplete: true} : text;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";

        // PDB and mmCIF responses are text, not JSON
        if (!contentType.includes("json")) {
            return { status: response.status, data: text };
        }

        try { return {status: response.status, data: JSON.parse(text)}; }
        catch {
            throw Object.assign(new Error("AlphaFold returned invalid JSON"), {status: 502,
                data: {native_text: text, http_status: response.status, incomplete: true, submission_state_unknown: submission}});
        }
    };
}
