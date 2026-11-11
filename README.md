# Alphafold MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream Alphafold API in natural language. It is one of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Connect

The server is deployed and ready at:

```
https://alphafold-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "alphafold": {
      "command": "npx",
      "args": ["mcp-remote", "https://alphafold-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8834/mcp` (start it with `./scripts/dev-servers.sh alphafold`):

```json
{
  "mcpServers": {
    "alphafold-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8834/mcp"]
    }
  }
}
```

## Tools

- `alphafolddb_search` — discover available API operations (Code Mode catalog search, 8 endpoints)
- `alphafolddb_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `api.post()` / `searchSpec()`) instead of issuing tool calls one by one
- `alphafolddb_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `alphafolddb_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

All four tool families also expose their `mcp_` aliases. SQL and schema responses
above 30 KiB stage the complete original envelope for retrieval, including error
state and metadata, rather than exceeding the MCP transport limit.

The adapter forwards both cataloged POST routes (`/sequence/search/` and
`/sequence/filtered-entries`) with their query options and native JSON bodies.
Previously these requests were incorrectly sent as GET and their bodies were
dropped. POST bodies are limited to 256 KiB and submissions are never automatically
retried. Retain the provider's task receipt; after an HTTP/transport failure,
`submission_state_unknown` warns that a sequence-search job may already exist.
Current POST payload schemas and polling behavior remain live-validation work.

Success and error bodies are limited to 8 MiB, with a 15-second body deadline
after the HTTP client's existing 30-second header/retry budget. Native JSON and
text response shapes are preserved; failed/capped reads are explicit errors.
Large complex records retain all chain, model, version and confidence fields
through the existing Code Mode staging path.

## Complex discovery and confidence

The existing `/complex/{qualifier}` operation covers complex predictions; this update adds discovery/inspection recipes rather than a second complex tool. The [May 2026 release](https://www.ebi.ac.uk/about/news/technology-and-innovation/first-complexes-alphafold-database/) adds heterodimers, and the [provider homepage and FAQ](https://alphafold.ebi.ac.uk/faq) describe September's Viral complexes and VAD additions. These datasets differ in source sequences, model generation and display thresholds. Broader, lower-confidence collections are available separately through provider downloads.

Catalog recipes use a bounded complex search for Q77HN0 and inspection of the provider's featured model `AF-0000000213001003`. They return the full response so provider/dataset IDs, model versions, chain identities, pagination and future fields survive. Preserve `modelEntityId`, `providerId`, `latestVersion` and all supplied confidence metadata. Missing values remain unknown; zero values must not be dropped.

pLDDT measures local structural confidence. Interface metrics such as ipTM, ipSAE, pDockQ2 and LIS address different questions and should remain separate. Low pLDDT is not proof of disorder, high interface confidence is not experimental confirmation, and absence from confidence-filtered search is not evidence that two proteins cannot interact.

Validation status (September 27, 2026): workflow execution and metadata preservation pass fixture tests through the actual API proxy. Direct public prediction, complex, search and OpenAPI requests returned HTTP 403 from the development environment. The local MCP contract harness passed nine checks using the existing 3D-Beacons summary route; staging was skipped. A subsequent complex-search probe encountered a Workerd segmentation fault and HTTP 503, so live retrieval through the new recipes remains unverified. Access errors must not be converted into empty results. No provider credentials are bundled with this server.

October 1 follow-up: 30 focused tests, TypeScript/lint and 36 static checks pass.
Tests exercise POST forwarding/no retries, body limits, complete large-complex
success/error recovery through both Code Mode aliases, and large SQL/schema
retrieval. These are synthetic fixtures; no live job was submitted. Current
complex-data, POST-schema and MCP acceptance remain pending.

## Development

```bash
./scripts/dev-servers.sh alphafold            # run locally (port 8834)
pnpm --filter alphafold-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

---

*Auto-generated baseline README — refine with server-specific detail as needed.*

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from AlphaFold DB and stays under the terms of that source: CC BY 4.0.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
