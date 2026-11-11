import type { WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";

export const complexWorkflows: WorkflowRecipe[] = [
  {
    title: "Discover viral complex predictions without losing source or confidence",
    description: "Search up to five complex records for the provider's September 2026 Q77HN0 example. Retain the whole response, including dataset/model/version fields, chain mappings, confidence and pagination. API access is required; HTTP errors are not negative evidence.",
    keywords: ["viral", "complex", "heterodimer", "VAD", "confidence", "2026"],
    code: 'const request = {q: "Q77HN0", type: "main", rows: 5, start: 0, fq: "isComplex:true"}; const response = await api.get("/search", request); return {request, response, interpretation: "Predicted complexes; retain provider and model versions. pLDDT is local confidence, not interface confidence or experimental validation. Search coverage is confidence-filtered, not exhaustive."};',
  },
  {
    title: "Inspect a published complex model with full metadata",
    description: "Look up the AF-0000000213001003 viral complex featured on the provider's September 2026 homepage. Preserve the complete response; inspect interface metrics independently of local pLDDT. Replace the qualifier with a model or accession found by discovery.",
    keywords: ["complex", "model", "version", "ipTM", "ipSAE", "pDockQ2", "LIS"],
    code: 'const qualifier = "AF-0000000213001003"; const response = await api.get("/complex/{qualifier}", {qualifier}); return {qualifier, response, interpretation: "This is a structural prediction, not proof of an interaction. Retain dataset/provider, model version, chain identities and all supplied confidence measures. Missing metrics remain unknown."};',
  },
];
