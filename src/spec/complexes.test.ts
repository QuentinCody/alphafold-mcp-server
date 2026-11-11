/// <reference types="node" />
import { runInNewContext } from "node:vm";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { afterEach, expect, it, vi } from "vitest";
import { createAlphafoldApiFetch } from "../lib/api-adapter";
import { alphafoldCatalog } from "./catalog";
import { complexWorkflows } from "./complexes";

afterEach(() => vi.unstubAllGlobals());
// Documented identity/confidence fields plus arbitrary nested metadata; not a live API record.
const record = {modelEntityId: "AF-fixture", latestVersion: 2, providerId: "fixture-provider", isComplex: true, globalMetricValue: 88.4, complexPredictionAccuracy_ipTM: 0, complexPredictionAccuracy_ipSAE: 0.73, chainMapping: {A: "Q77HN0", B: "partner"}, futureField: {retained: true}};

it("executes existing routes with bounded search and preserves raw metadata, zero values and absent metrics", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json([record]));
  vi.stubGlobal("fetch", fetch);
  // SAFETY: small fixtures never access a Durable Object or session handle.
  const proxy = createApiProxyTool({catalog: alphafoldCatalog, apiFetch: createAlphafoldApiFetch(), doNamespace: {} as DurableObjectNamespace, stagingPrefix: "alphafold"});
  // SAFETY: no capabilities are exercised by these inline fixture responses.
  const context = {} as Parameters<typeof proxy.handler>[1];
  const api = {get: (path: string, params?: Record<string, unknown>) => proxy.handler({method: "GET", path, params}, context)};
  for (const workflow of complexWorkflows) {
    const result = await runInNewContext(`(async()=>{${workflow.code}})()`, {api});
    expect(result.response).toEqual([record]);
    expect(result.response[0]).not.toHaveProperty("complexPredictionAccuracy_pDockQ2");
  }
  const urls = fetch.mock.calls.map(c => new URL(c[0]));
  expect(Object.fromEntries(urls[0].searchParams)).toEqual({q: "Q77HN0", type: "main", rows: "5", start: "0", fq: "isComplex:true"});
  expect(urls[1].pathname).toBe("/api/complex/AF-0000000213001003");
  expect(urls[1].search).toBe("");
  expect(alphafoldCatalog.endpoints.filter(e => e.path.startsWith("/complex/")).length).toBe(1);
});

it("keeps an upstream access denial as an error instead of a no-complex result", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", {status: 403})));
  await expect(createAlphafoldApiFetch()({method: "GET", path: "/complex/AF-0000000213001003"})).rejects.toMatchObject({status: 403, data: "Forbidden"});
});
