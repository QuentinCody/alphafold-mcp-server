import {McpServer} from "@bio-mcp/shared/mcp";
import {DynamicWorkerExecutor} from "@bio-mcp/shared/codemode/execute-tool";
import {afterEach, expect, it, vi} from "vitest";
import {registerCodeMode} from "./code-mode";
import {registerQueryData} from "./query-data";
import {registerGetSchema} from "./get-schema";
import {alphafoldResponse} from "../lib/tool-result";

afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});
function fixture() {
  const stored: unknown[] = [];
  const namespace = {idFromName: (name: string) => name, get: () => ({fetch: async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === "/process") {
      const data = (await request.json() as {data: unknown}).data;
      stored.push(typeof data === "string" ? JSON.parse(data) : data);
      return Response.json({success: true, tables_created: ["payloads"], total_rows: 1, input_rows: 1, table_row_counts: {payloads: 1}});
    }
    if (path === "/query") return Response.json({success: true, results: [{native_text: "α".repeat(60000)}], row_count: 1});
    return Response.json({success: true, schema: {tables: {rows: {columns: [{name: "native_text", description: "α".repeat(20000)}]}}}});
  }})};
  const env = {ALPHAFOLD_DATA_DO: namespace, CODE_MODE_LOADER: {get: () => ({})}} as unknown as Parameters<typeof registerCodeMode>[1];
  const server = new McpServer({name: "fixture", version: "1"});
  registerCodeMode(server, env); registerQueryData(server, env); registerGetSchema(server, env);
  const tools = (server as unknown as {_registeredTools: Record<string, {handler: (args: unknown, extra: unknown) => Promise<Record<string, unknown>>}>})._registeredTools;
  return {stored, env, tools};
}

it("registers every tool under both names and returns both fields for discovery and failures", async () => {
  const {tools} = fixture();
  expect(Object.keys(tools).sort()).toEqual(["alphafolddb_execute", "alphafolddb_get_schema", "alphafolddb_query_data", "alphafolddb_search", "mcp_alphafolddb_execute", "mcp_alphafolddb_get_schema", "mcp_alphafolddb_query_data", "mcp_alphafolddb_search"]);
  for (const prefix of ["", "mcp_"]) {
    expect(await tools[`${prefix}alphafolddb_search`].handler({query: "complex", max_results: 3}, {})).toMatchObject({content: expect.any(Array), structuredContent: {success: true}});
    expect(await tools[`${prefix}alphafolddb_execute`].handler({code: ""}, {})).toMatchObject({isError: true, content: expect.any(Array), structuredContent: {success: false}});
  }
});

it("preserves a complete large complex record through both real execute registrations", async () => {
  const {tools, stored} = fixture();
  const native = [{modelEntityId: "AF-fixture", providerId: "fixture-provider", latestVersion: 2,
    chainMapping: {A: "Q77HN0", B: "fixture"}, complexPredictionAccuracy_ipTM: 0,
    complexPredictionAccuracy_ipSAE: null, future: "α".repeat(30000)}];
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json(native)));
  // Replace only V8 execution; registration, adapter, staging and final envelopes are real.
  vi.spyOn(DynamicWorkerExecutor.prototype, "execute").mockImplementation(async (_code, fns) => ({result: await fns.__api_proxy({method: "GET", path: "/complex/AF-fixture"})}));
  for (const prefix of ["", "mcp_"]) {
    const result = await tools[`${prefix}alphafolddb_execute`].handler({code: "return await api.get('/complex/AF-fixture');"}, {});
    expect(result).toMatchObject({content: expect.any(Array), structuredContent: {success: true, _staging: expect.any(Object), _meta: {citation: {result_hash: expect.stringMatching(/^[a-f0-9]{64}$/)}}}});
    expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThan(100000);
  }
  expect(stored).toContainEqual(native);
});

it("keeps a large complex access failure as an error with complete recoverable evidence", async () => {
  const {tools, stored} = fixture(); const native = "Forbidden α".repeat(5000);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(native, {status: 403})));
  vi.spyOn(DynamicWorkerExecutor.prototype, "execute").mockImplementation(async (_code, fns) => ({result: await fns.__api_proxy({method: "GET", path: "/complex/AF-fixture"})}));
  const result = await tools.mcp_alphafolddb_execute.handler({code: "return await api.get('/complex/AF-fixture');"}, {});
  expect(result).toMatchObject({isError: true, content: expect.any(Array), structuredContent: {success: false}});
  expect(JSON.stringify(stored)).toContain(native);
  expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThan(100000);
});

it("bounds all SQL/schema aliases while keeping the complete original response", async () => {
  const {tools, stored} = fixture();
  for (const prefix of ["", "mcp_"]) for (const suffix of ["query_data", "get_schema"]) {
    const result = await tools[`${prefix}alphafolddb_${suffix}`].handler({data_access_id: "fixture", sql: "SELECT native_text FROM rows"}, {});
    expect(result).toMatchObject({content: expect.any(Array), structuredContent: {success: true, staged: true, _staging: expect.any(Object)}});
    expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThan(30000);
  }
  expect(JSON.stringify(stored)).toContain("α".repeat(60000));
});

it.each([false, true])("retains error state and metadata when staging a full envelope: %s", async failed => {
  const {stored, env} = fixture();
  const original = {content: [{type: "text" as const, text: "α".repeat(20000)}], structuredContent: {success: !failed, _meta: {citation: {result_hash: "fixture"}}}};
  const result = await alphafoldResponse(async () => original, env, "alphafolddb_query_data", {});
  expect(result).toMatchObject({content: expect.any(Array), structuredContent: {success: !failed, staged: true, _staging: expect.any(Object), _meta: original.structuredContent._meta}});
  expect(result.isError === true).toBe(failed);
  expect(stored).toContainEqual({...original, ...(failed ? {isError: true} : {})});
});

it.each(["throw", "oversize"])("returns a bounded explicit error if %s cannot be delivered", async mode => {
  const result = await alphafoldResponse(async () => {
    if (mode === "throw") throw new Error("private detail");
    return {content: [{type: "text", text: "x".repeat(40000)}]};
  }, {}, "alphafolddb_query_data", {});
  expect(result).toMatchObject({isError: true, content: expect.any(Array), structuredContent: {success: false}});
  expect(JSON.stringify(result)).not.toContain("private detail");
});
