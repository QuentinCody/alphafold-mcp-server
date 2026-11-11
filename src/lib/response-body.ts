/** Bound body reads after the HTTP client's own 30-second header/retry budget. */
export async function readAlphafoldBody(response: Response): Promise<string> {
  const limit = 8 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit) {
    void response.body?.cancel().catch(() => {}); throw new Error("AlphaFold response exceeds 8 MiB");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AlphaFold response body exceeded 15 seconds")), 15000);
  });
  const read = async () => {
    const decoder = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});
    let text = ""; let bytes = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("AlphaFold response exceeds 8 MiB");
      text += decoder.decode(value, {stream: true});
    }
    return text + decoder.decode();
  };
  try { return await Promise.race([read(), expired]); }
  finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}
