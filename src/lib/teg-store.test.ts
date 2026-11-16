import { describe, expect, it } from "vitest";
import { createSessionStore } from "./teg-store";
import { EMPTY_CONTEXT, EMPTY_VALUES } from "./teg-algorithm";
const v = { ...EMPTY_VALUES, CK_R: 6 };
const c = { ...EMPTY_CONTEXT, adultConfirmed: true, cartridgeConfirmed: true };
function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}
describe("session safety", () => {
  it("exact verification survives readback but edits revoke it", () => {
    const storage = memory();
    const s = createSessionStore(() => storage);
    s.saveValues(v);
    s.saveContext(c);
    expect(s.verify()).toBe(true);
    expect(createSessionStore(() => storage).isVerified()).toBe(true);
    s.saveValues({ ...v, CK_R: 7 });
    expect(s.isVerified()).toBe(false);
    s.verify();
    s.saveContext({ ...c, bleeding: "active" });
    expect(s.isVerified()).toBe(false);
  });
  it("empty and incompatible cannot verify", () => {
    const s = createSessionStore(() => memory());
    s.saveValues(EMPTY_VALUES);
    s.saveContext(c);
    expect(s.verify()).toBe(false);
    s.saveValues(v);
    s.saveContext(EMPTY_CONTEXT);
    expect(s.verify()).toBe(false);
  });
  it("blocked storage has reactive memory fallback and clears context", () => {
    const s = createSessionStore(() => {
      throw new Error("blocked");
    });
    let count = 0;
    s.subscribe(() => count++);
    s.saveValues(v);
    s.saveContext(c);
    expect(s.verify()).toBe(true);
    s.clear();
    expect(s.read().context).toEqual(EMPTY_CONTEXT);
    expect(s.read().values).toEqual(EMPTY_VALUES);
    expect(s.isVerified()).toBe(false);
    expect(count).toBe(4);
  });
  it("quota failure removes stale saved case", () => {
    const storage = memory();
    const s = createSessionStore(() => storage);
    s.saveValues(v);
    storage.setItem = () => {
      throw new Error("quota");
    };
    s.saveValues({ ...v, CK_R: 8 });
    expect(s.read().values.CK_R).toBe(8);
    expect(createSessionStore(() => storage).read().hasValues).toBe(false);
  });
  it.each(["{", '{"values":{"CK_R":"6"}}', "null", "[]"])("sanitizes corrupt storage %s", (raw) => {
    const storage = memory();
    storage.setItem("clot-clarity-case-v2", raw);
    expect(createSessionStore(() => storage).read().hasValues).toBe(false);
  });
  it("does not import old patient context", () => {
    const storage = memory();
    storage.setItem("teg-values-v1", JSON.stringify(v));
    storage.setItem("teg-population-v1", "pregnant");
    const s = createSessionStore(() => storage);
    expect(s.read().context).toEqual(EMPTY_CONTEXT);
    expect(s.read().hasValues).toBe(false);
  });
});

describe("storage recovery and isolation", () => {
  it("transient failed read then clear removes old case", () => {
    const disk = memory();
    const old = createSessionStore(() => disk);
    old.begin(v);
    old.saveContext(c);
    old.verify();
    let blocked = true;
    const s = createSessionStore(() => {
      if (blocked) throw Error("blocked");
      return disk;
    });
    expect(s.read().hasValues).toBe(false);
    blocked = false;
    s.clear();
    expect(createSessionStore(() => disk).read().hasValues).toBe(false);
  });
  it("failed write and removal then recovered clear retries invalidation", () => {
    const disk = memory();
    const s = createSessionStore(() => disk);
    s.begin(v);
    let blocked = true;
    const set = disk.setItem;
    const remove = disk.removeItem;
    disk.setItem = (k, v) => {
      if (blocked) throw Error("blocked");
      set(k, v);
    };
    disk.removeItem = (k) => {
      if (blocked) throw Error("blocked");
      remove(k);
    };
    s.saveValues({ ...v, CK_R: 9 });
    expect(s.read().storageWarning).toBe(true);
    blocked = false;
    s.clear();
    expect(createSessionStore(() => disk).read().hasValues).toBe(false);
    expect(s.read().storageWarning).toBe(false);
  });
  it("legacy removal failure does not disable current persistence", () => {
    const disk = memory();
    const remove = disk.removeItem;
    disk.removeItem = (k) => {
      if (k === "teg-values-v1") throw Error("legacy");
      remove(k);
    };
    const s = createSessionStore(() => disk);
    s.read();
    s.begin(v);
    expect(createSessionStore(() => disk).read().values).toEqual(v);
  });
  it("atomic new case resets every context field while value edit preserves context", () => {
    const disk = memory();
    const s = createSessionStore(() => disk);
    s.begin(v);
    s.saveContext({
      ...c,
      population: "pregnant",
      bleeding: "active",
      indication: "pph",
      withinThreeHours: "yes",
    });
    const before = s.read().context;
    s.saveValues({ ...v, CK_R: 7 });
    expect(s.read().context).toEqual(before);
    s.begin(v);
    expect(s.read().context).toEqual(EMPTY_CONTEXT);
    expect(s.isVerified()).toBe(false);
  });
  it.each(Object.keys(EMPTY_VALUES))("every value edit revokes verification %s", (k) => {
    const s = createSessionStore(() => memory());
    s.begin(v);
    s.saveContext(c);
    s.verify();
    s.saveValues({ ...v, [k]: k.includes("R") ? 7 : 22 });
    expect(s.isVerified()).toBe(false);
  });
  it.each(Object.keys(EMPTY_CONTEXT))("every context edit revokes verification %s", (k) => {
    const s = createSessionStore(() => memory());
    s.begin(v);
    s.saveContext(c);
    s.verify();
    const edits = {
      adultConfirmed: false,
      cartridgeConfirmed: false,
      population: "pregnant",
      bleeding: "active",
      indication: "trauma",
      withinThreeHours: "yes",
    };
    s.saveContext({ ...c, [k]: edits[k as keyof typeof edits] } as typeof c);
    expect(s.isVerified()).toBe(false);
  });
});
