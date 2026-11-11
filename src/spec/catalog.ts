/**
 * AlphaFold DB API catalog. Current OpenAPI retrieval remains unverified.
 *
 * Pre-computed predicted protein structures for 200M+ proteins.
 * No ML inference at query time — this is a lookup database.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";
import { complexWorkflows } from "./complexes";

export const alphafoldCatalog: ApiCatalog = {
    name: "AlphaFold DB",
    baseUrl: "https://alphafold.ebi.ac.uk/api",
    version: "1.0",
    auth: "none",
    endpointCount: 8,
    notes:
        "- Pre-computed structures by UniProt accession (e.g., Q5VSL9, P00533, P38398)\n" +
        "- /prediction returns an ARRAY — one entry per isoform/fragment\n" +
        "- Each entry has download URLs: pdbUrl, cifUrl, paeDocUrl (fetch these directly)\n" +
        "- pLDDT describes local structural confidence: >90 very high, 70-90 confident, 50-70 low, <50 very low. Low confidence alone does not prove disorder.\n" +
        "- globalMetricValue = overall pLDDT (0-100)\n" +
        "- /complex returns predicted complexes, not experimentally established interactions. May 2026 added heterodimers; September 2026 added Viral complexes and VAD datasets. Preserve providerId, modelEntityId, latestVersion, chain/accession mapping and every supplied confidence field.\n" +
        "- Interface confidence is separate from pLDDT: retain complexPredictionAccuracy_ipTM, complexPredictionAccuracy_ipSAE, complexPredictionAccuracy_pDockQ2 and complexPredictionAccuracy_LIS where provided. Missing values are unknown, not zero.\n" +
        "- Public-site complex records are confidence-filtered; lower-confidence bulk predictions have different coverage. Absence from search does not establish absence of an interaction. Use the provider FAQ/downloads for dataset-specific scope.\n" +
        "- /annotations returns AlphaMissense variant effect predictions\n" +
        "- /search is Solr-based: q and type params required\n" +
        "- /sequence/search/ uses POST and is async. Retain its native task receipt; submission is never automatically retried. A transport failure can leave acceptance unknown.\n" +
        "- POST bodies are native JSON (max 256 KiB); do not infer live batch/job schemas from transport support. Reads enforce 8 MiB and a 15-second body deadline after the HTTP client's header budget.\n" +
        "- Public API access may return HTTP 403; retain it as an access error, not an empty biological result. See https://alphafold.ebi.ac.uk/api-docs and https://alphafold.ebi.ac.uk/faq .",
    workflows: complexWorkflows,
    endpoints: [
        // === Prediction ===
        {
            method: "GET",
            path: "/prediction/{qualifier}",
            summary:
                "Get predicted structure metadata by UniProt accession or AlphaFold entry ID. " +
                "Returns an ARRAY of entries (one per isoform/fragment) with modelEntityId, " +
                "globalMetricValue (pLDDT), gene, organism, and download URLs (pdbUrl, cifUrl, paeDocUrl). " +
                "Use base accession (e.g., P38398) to get all isoforms.",
            category: "prediction",
            pathParams: [
                {
                    name: "qualifier",
                    type: "string",
                    required: true,
                    description:
                        "UniProt accession (e.g., Q5VSL9, P38398) or AlphaFold entry ID (e.g., AF-Q5VSL9-F1)",
                },
            ],
            queryParams: [
                {
                    name: "sequence_checksum",
                    type: "string",
                    required: false,
                    description: "MD5 checksum of the UniProt sequence to filter by specific sequence version",
                },
            ],
        },

        // === Complex (AlphaFold Multimer) ===
        {
            method: "GET",
            path: "/complex/{qualifier}",
            summary:
                "Get AlphaFold Multimer complex predictions for a UniProt accession or model ID. " +
                "Returns predicted protein complex structures as hypotheses about interactions. " +
                "Retain chain assignments, provider/dataset, model version, interface confidence metrics and download URLs as supplied; not every model has every metric.",
            category: "complex",
            pathParams: [
                {
                    name: "qualifier",
                    type: "string",
                    required: true,
                    description: "UniProt accession or AlphaFold complex model ID",
                },
            ],
            usageHint: "Use the existing complex endpoint for homodimers and heterodimers. Keep local confidence (pLDDT) separate from interface scores; do not infer experimental validation from either. Full raw metadata preserves future provider fields.",
        },

        // === Annotations (AlphaMissense) ===
        {
            method: "GET",
            path: "/annotations/{qualifier}.json",
            summary:
                "Get variant effect annotations for a UniProt protein. With type=MUTAGEN, returns " +
                "AlphaMissense pathogenicity predictions for all possible single amino acid substitutions. " +
                "Each annotation includes position, wild-type residue, mutant residue, and pathogenicity score.",
            category: "annotations",
            pathParams: [
                {
                    name: "qualifier",
                    type: "string",
                    required: true,
                    description: "UniProt accession (e.g., Q5VSL9, P00533)",
                },
            ],
            queryParams: [
                {
                    name: "type",
                    type: "string",
                    required: true,
                    description: "Annotation type. Use 'MUTAGEN' for AlphaMissense variant pathogenicity predictions.",
                },
            ],
        },

        // === UniProt Summary (3D-Beacons) ===
        {
            method: "GET",
            path: "/uniprot/summary/{qualifier}.json",
            summary:
                "Lightweight 3D-Beacons summary for a UniProt protein. Returns uniprot_entry " +
                "(accession, sequence_length) and structures array with model_identifier, coverage, " +
                "and confidence_avg_local_score. Good for checking existence and quality.",
            category: "uniprot",
            pathParams: [
                {
                    name: "qualifier",
                    type: "string",
                    required: true,
                    description: "UniProt accession (e.g., Q5VSL9, P00533, P04637)",
                },
            ],
        },

        // === Search (Solr) ===
        {
            method: "GET",
            path: "/search",
            summary:
                "Search AlphaFold DB via Solr. Searches gene names, organisms, UniProt accessions. " +
                "Both q and type are required. Returns paginated results.",
            category: "search",
            queryParams: [
                {
                    name: "q",
                    type: "string",
                    required: true,
                    description: "Search query (e.g., gene name 'BRCA1', organism 'Homo sapiens')",
                },
                {
                    name: "type",
                    type: "string",
                    required: true,
                    description: "Search type (e.g., 'main')",
                },
                {
                    name: "rows",
                    type: "number",
                    required: false,
                    description: "Number of results to return (default 10)",
                },
                {
                    name: "start",
                    type: "number",
                    required: false,
                    description: "Pagination offset (0-indexed)",
                },
                {
                    name: "sort",
                    type: "string",
                    required: false,
                    description: "Sort order for results",
                },
                {
                    name: "fq",
                    type: "string",
                    required: false,
                    description: "Solr filter query for narrowing results",
                },
                {
                    name: "fields",
                    type: "string",
                    required: false,
                    description: "Comma-separated list of fields to return",
                },
            ],
        },

        // === Sequence Summary ===
        {
            method: "GET",
            path: "/sequence/summary",
            summary:
                "Get a summary of AlphaFold-predicted structures available for a sequence identifier. " +
                "Returns model counts and basic metadata without full structure data.",
            category: "sequence",
            queryParams: [
                {
                    name: "id",
                    type: "string",
                    required: true,
                    description: "Identifier for the sequence (e.g., UniProt accession)",
                },
                {
                    name: "type",
                    type: "string",
                    required: false,
                    description: "Type of identifier (default: UniProt)",
                },
                {
                    name: "rows",
                    type: "number",
                    required: false,
                    description: "Number of results to return (max 500)",
                },
            ],
        },

        // === Sequence Search (async — submit job) ===
        {
            method: "POST",
            path: "/sequence/search/",
            summary:
                "Submit a sequence similarity search job. Returns a task ID for polling. " +
                "NOTE: This is ASYNC — the search runs in the background. You get back a task ID, " +
                "not immediate results. Not suitable for quick synchronous queries.",
            category: "sequence",
            usageHint: "Submit once and retain the returned task receipt. HTTP/transport errors do not prove that no job was created. Live submission and polling contracts remain unverified here; no polling route is inferred from an ID.",
            queryParams: [
                {
                    name: "sequence",
                    type: "string",
                    required: true,
                    description: "Amino acid sequence to search (one-letter codes)",
                },
            ],
        },

        // === Sequence Filtered Entries ===
        {
            method: "POST",
            path: "/sequence/filtered-entries",
            summary:
                "Batch lookup of metadata for multiple UniProt accessions in the sequence-search flow. " +
                "POST a JSON body with a list of accessions to get their AlphaFold entry metadata.",
            category: "sequence",
            body: {contentType: "application/json", description: "Native provider batch payload, passed through without field rewriting; maximum 256 KiB. Current provider field schema remains unverified."},
            usageHint: "The adapter now forwards POST and its JSON body. Keep provider field names and native response metadata; transport tests do not establish live schema acceptance.",
        },
    ],
};
