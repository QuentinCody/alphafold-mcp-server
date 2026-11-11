import {afterEach, expect, it, vi} from "vitest";
import {readAlphafoldBody} from "./response-body";
afterEach(() => vi.useRealTimers());

it("retains native Unicode, BOM and split UTF-8 characters", async () => {
  const text = "\ufeffdata_fixture\n# α\n";
  const bytes = new TextEncoder().encode(text);
  const response = new Response(new ReadableStream({start(controller) {for (const b of bytes) controller.enqueue(Uint8Array.of(b)); controller.close();}}));
  expect(await readAlphafoldBody(response)).toBe(text);
});

it("rejects invalid UTF-8 instead of inserting replacement characters", async () => {
  await expect(readAlphafoldBody(new Response(Uint8Array.of(0xff)))).rejects.toThrow();
});

it("cancels an advertised oversized body without reading it", async () => {
  const cancel = vi.fn(); const body = new ReadableStream({cancel});
  await expect(readAlphafoldBody(new Response(body, {headers: {"Content-Length": "8388609"}}))).rejects.toThrow("8 MiB");
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("bounds actual bytes despite an understated content-length", async () => {
  await expect(readAlphafoldBody(new Response(new Uint8Array(8388609), {headers: {"Content-Length": "1"}}))).rejects.toThrow("8 MiB");
});

it("times out a stalled stream without waiting for cancellation to resolve", async () => {
  vi.useFakeTimers(); const cancel = vi.fn(() => new Promise<void>(() => {}));
  const outcome = readAlphafoldBody(new Response(new ReadableStream({cancel}))).catch(error => error);
  await vi.advanceTimersByTimeAsync(15000);
  expect(await outcome).toMatchObject({message: "AlphaFold response body exceeded 15 seconds"}); expect(cancel).toHaveBeenCalledTimes(1);
});

it("returns an empty absent body without inventing a JSON object", async () => {
  expect(await readAlphafoldBody(new Response(null, {status: 204}))).toBe("");
});
