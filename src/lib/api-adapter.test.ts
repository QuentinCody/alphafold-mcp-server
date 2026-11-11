import {afterEach, expect, it, vi} from "vitest";
import {createAlphafoldApiFetch} from "./api-adapter";
const api = createAlphafoldApiFetch();
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("forwards a sequence-search POST and query exactly once, retaining the native asynchronous receipt", async () => {
  const native = {task_id: "fixture-task", status: "pending", future: {retain: true}};
  const fetcher = vi.fn().mockResolvedValue(Response.json(native, {status: 202})); vi.stubGlobal("fetch", fetcher);
  expect(await api({method: "POST", path: "/sequence/search/", params: {sequence: "ACDEFGHIKLMNPQRSTVWYACD"}})).toEqual({status: 202, data: native});
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0];
  expect(new URL(url).pathname).toBe("/api/sequence/search/");
  expect(new URL(url).searchParams.get("sequence")).toBe("ACDEFGHIKLMNPQRSTVWYACD");
  expect(init.method).toBe("POST"); expect(init.body).toBeUndefined();
});

it("forwards native JSON batch bodies and query options without rewriting fields", async () => {
  // Transport fixture, not a claim that the live provider accepts this field schema.
  const body = {accessions: ["P00533", "P00533"], future: {value: null}};
  const native = [{modelEntityId: "AF-fixture", complexPredictionAccuracy_ipTM: 0, unknown: [null]}];
  const fetcher = vi.fn().mockResolvedValue(Response.json(native)); vi.stubGlobal("fetch", fetcher);
  expect(await api({method: "POST", path: "/sequence/filtered-entries", params: {type: "fixture"}, body})).toEqual({status: 200, data: native});
  const [url, init] = fetcher.mock.calls[0];
  expect(new URL(url).searchParams.get("type")).toBe("fixture");
  expect(init).toMatchObject({method: "POST", headers: {"Content-Type": "application/json"}});
  expect(JSON.parse(init.body)).toEqual(body);
});

it.each([429, 500, 502, 503])("does not replay a sequence submission on HTTP %i", async status => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("upstream failure", {status, headers: {"Retry-After": "60"}})); vi.stubGlobal("fetch", fetcher);
  await expect(api({method: "POST", path: "/sequence/search/", params: {sequence: "ACDEFGHIKLMNPQRSTVWYACD"}})).rejects.toMatchObject({status, data: {native_text: "upstream failure", submission_state_unknown: true, incomplete: true, retry_after: "60"}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("retains unknown submission state on transport failure without retries", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("network")); vi.stubGlobal("fetch", fetcher);
  await expect(api({method: "POST", path: "/sequence/search/"})).rejects.toMatchObject({status: 502, data: {submission_state_unknown: true}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("retains an invalid JSON submission receipt without treating it as a confirmed rejection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("broken", {status: 202, headers: {"Content-Type": "application/json"}})));
  await expect(api({method: "POST", path: "/sequence/search/"})).rejects.toMatchObject({status: 502, data: {native_text: "broken", http_status: 202, submission_state_unknown: true}});
});

it.each([
  {method: "DELETE", path: "/complex/model"}, {method: "POST", path: "/complex/model", body: {}},
  {method: "GET", path: "/complex/model", body: {}},
  {method: "POST", path: "/sequence/filtered-entries", body: "α".repeat(140000)},
])("rejects unsupported or oversized input before a provider call: %j", async request => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(api(request)).rejects.toMatchObject({status: 400}); expect(fetcher).not.toHaveBeenCalled();
});

it("preserves native text responses and raw GET error bodies", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("data_fixture\n# α\n", {headers: {"Content-Type": "text/plain"}})).mockResolvedValueOnce(new Response("Forbidden", {status: 403})); vi.stubGlobal("fetch", fetcher);
  expect(await api({method: "GET", path: "/prediction/P00533", params: {sequence_checksum: "fixture"}})).toEqual({status: 200, data: "data_fixture\n# α\n"});
  await expect(api({method: "GET", path: "/complex/AF-fixture"})).rejects.toMatchObject({status: 403, data: "Forbidden"});
});

it("fails explicitly for an oversized response body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(8 * 1024 * 1024 + 1))));
  await expect(api({method: "GET", path: "/complex/AF-fixture"})).rejects.toMatchObject({status: 502, data: {body_complete: false, incomplete: true}});
});
