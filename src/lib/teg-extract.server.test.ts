import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOcr } from "./teg-extract.server";
afterEach(() => vi.useRealTimers());
const result = {
  device: "TEG6s",
  cartridge: "Global Hemostasis CK CKH CRT CFF",
  readings: [{ channel: "CFF", parameter: "MA", raw: "22", complete: true }],
};
const response = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }));
describe("upstream OCR response safety", () => {
  it("parses supported completed readings", async () => {
    expect(
      (
        await requestOcr(
          "synthetic",
          "test-only",
          vi.fn(async () => response(JSON.stringify(result))),
        )
      ).CFF_MA,
    ).toBe(22);
  });
  it.each([402, 403, 429, 500])("never exposes provider body for status %s", async (status) => {
    const fetcher = vi.fn(async () => new Response("private-provider-error", { status }));
    await expect(requestOcr("synthetic", "test-only", fetcher)).rejects.not.toThrow(
      "private-provider-error",
    );
  });
  it.each(["not-json", "{}", JSON.stringify({ ...result, device: "ROTEM" })])(
    "rejects invalid model response %s",
    async (content) => {
      await expect(
        requestOcr(
          "synthetic",
          "test-only",
          vi.fn(async () => response(content)),
        ),
      ).rejects.toThrow();
    },
  );
  it("masks transport errors", async () => {
    await expect(
      requestOcr(
        "synthetic",
        "test-only",
        vi.fn(async () => {
          throw new Error("private-provider-error");
        }),
      ),
    ).rejects.toThrow("Photo reading failed");
  });
  it.each(["headers", "body"])("deadline aborts stalled %s", async (phase) => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = async (_url, init) => {
      const stalled = () =>
        new Promise<never>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          }),
        );
      if (phase === "headers") return stalled();
      return { ok: true, json: stalled } as unknown as Response;
    };
    const pending = requestOcr("synthetic", "test-only", fetcher, 30);
    const assertion = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(31);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("caller cancellation reaches body reader", async () => {
    const caller = new AbortController();
    let signal: AbortSignal | null | undefined;
    const fetcher: typeof fetch = async (_url, init) => {
      signal = init?.signal;
      return {
        ok: true,
        json: () =>
          new Promise((_, reject) =>
            signal?.addEventListener("abort", () => reject(new Error("cancelled"))),
          ),
      } as Response;
    };
    const pending = requestOcr("synthetic", "test-only", fetcher, 30000, caller.signal);
    await Promise.resolve();
    caller.abort();
    await expect(pending).rejects.toThrow("timed out");
    expect(signal?.aborted).toBe(true);
  });
});
