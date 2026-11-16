import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureRun, coherentFrame, validatePhoto } from "./teg-capture";
import { EMPTY_VALUES } from "./teg-algorithm";
import { parseOcr } from "./teg-ocr";
const frame = { ...EMPTY_VALUES, CK_R: 6, CKH_R: 6, CRT_MA: 60 };
afterEach(() => vi.useRealTimers());
describe("capture and OCR safeguards", () => {
  it("only consecutive identical visible sets confirm; never merge missing keys", () => { expect(coherentFrame(frame, frame)).toEqual(frame); expect(coherentFrame(frame, { ...frame, CFF_MA: 20 })).toBeNull(); expect(coherentFrame(frame, { ...frame, CK_R: 6.1 })).toBeNull(); expect(coherentFrame(null, frame)).toBeNull(); });
  it("stale camera completion stops every track", async () => { const run = new CaptureRun(); const token = run.start(); const stop = vi.fn(); let resolve: (s: MediaStream) => void = () => {}; const acquire = new Promise<MediaStream>(r => { resolve = r; }); const pending = run.camera(token, () => acquire); run.stop(); resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); expect(await pending).toBeNull(); expect(stop).toHaveBeenCalledOnce(); });
  it("manual/stop/restart cancel delayed navigation and pending photo", async () => { vi.useFakeTimers(); const run = new CaptureRun(); const token = run.start(); const nav = vi.fn(); run.later(token, nav, 600); const pending = run.wait(token, () => new Promise(() => {})); const assertion = expect(pending).rejects.toThrow("cancelled"); run.start(); await assertion; await vi.advanceTimersByTimeAsync(1000); expect(nav).not.toHaveBeenCalled(); expect(run.alive(token)).toBe(false); });
  it("full pending read times out", async () => { vi.useFakeTimers(); const run = new CaptureRun(); const token = run.start(); const p = run.wait(token, () => new Promise(() => {}), 30); const assertion = expect(p).rejects.toThrow("timed out"); await vi.advanceTimersByTimeAsync(31); await assertion; });
  it.each([{ type: "text/plain", size: 10 }, { type: "image/jpeg", size: 0 }, { type: "image/png", size: 10485761 }])("rejects invalid file %j", file => expect(() => validatePhoto(file)).toThrow());
  it("accepts bounded JPEG", () => expect(() => validatePhoto({ type: "image/jpeg", size: 10485760 })).not.toThrow());
  const make = (raw: string, complete = true, parameter = "MA") => ({ device: "TEG6s", cartridge: "Global Hemostasis CK CKH CRT CFF", readings: [{ channel: "CFF", parameter, raw, complete }] });
  it.each(["<17", ">60", "17*", "17 mm", "NaN", "1e2"])("does not strip symbols %s", raw => expect(parseOcr(make(raw)).CFF_MA).toBeNull());
  it("rejects in-progress and A10/A5 substitution", () => { expect(parseOcr(make("17", false)).CFF_MA).toBeNull(); for (const p of ["A10", "A5"]) expect(() => parseOcr(make("17", true, p))).toThrow(); });
  it.each(["ROTEM", "TEG5000", "unknown"])("rejects other device %s", device => expect(() => parseOcr({ ...make("17"), device })).toThrow());
  it("rejects HN and accepts correct MA", () => { expect(() => parseOcr({ ...make("17"), cartridge: "HN" })).toThrow(); expect(parseOcr(make("17")).CFF_MA).toBe(17); });
});
