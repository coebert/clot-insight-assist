import { describe, expect, it } from "vitest";
import { createSessionStore } from "./teg-store";
import { EMPTY_CONTEXT, EMPTY_VALUES } from "./teg-algorithm";
const v = { ...EMPTY_VALUES, CK_R: 6 };
const c = { ...EMPTY_CONTEXT, adultConfirmed: true, cartridgeConfirmed: true };
function memory() { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; }
describe("session safety", () => {
  it("exact verification survives readback but edits revoke it", () => { const storage = memory(); const s = createSessionStore(() => storage); s.saveValues(v); s.saveContext(c); expect(s.verify()).toBe(true); expect(createSessionStore(() => storage).isVerified()).toBe(true); s.saveValues({ ...v, CK_R: 7 }); expect(s.isVerified()).toBe(false); s.verify(); s.saveContext({ ...c, bleeding: "active" }); expect(s.isVerified()).toBe(false); });
  it("empty and incompatible cannot verify", () => { const s = createSessionStore(() => memory()); s.saveValues(EMPTY_VALUES); s.saveContext(c); expect(s.verify()).toBe(false); s.saveValues(v); s.saveContext(EMPTY_CONTEXT); expect(s.verify()).toBe(false); });
  it("blocked storage has reactive memory fallback and clears context", () => { const s = createSessionStore(() => { throw new Error("blocked"); }); let count = 0; s.subscribe(() => count++); s.saveValues(v); s.saveContext(c); expect(s.verify()).toBe(true); s.clear(); expect(s.read().context).toEqual(EMPTY_CONTEXT); expect(s.read().values).toEqual(EMPTY_VALUES); expect(s.isVerified()).toBe(false); expect(count).toBe(4); });
  it("quota failure removes stale saved case", () => { const storage = memory(); const s = createSessionStore(() => storage); s.saveValues(v); storage.setItem = () => { throw new Error("quota"); }; s.saveValues({ ...v, CK_R: 8 }); expect(s.read().values.CK_R).toBe(8); expect(createSessionStore(() => storage).read().hasValues).toBe(false); });
  it.each(['{', '{"values":{"CK_R":"6"}}', 'null', '[]'])("sanitizes corrupt storage %s", raw => { const storage = memory(); storage.setItem("clot-clarity-case-v2", raw); expect(createSessionStore(() => storage).read().hasValues).toBe(false); });
  it("does not import old patient context", () => { const storage = memory(); storage.setItem("teg-values-v1", JSON.stringify(v)); storage.setItem("teg-population-v1", "pregnant"); const s = createSessionStore(() => storage); expect(s.read().context).toEqual(EMPTY_CONTEXT); expect(s.read().hasValues).toBe(false); });
});
