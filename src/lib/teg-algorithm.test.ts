import { describe, expect, it } from "vitest";
import { EMPTY_CONTEXT, EMPTY_VALUES, KEYS, PLAUSIBLE, REFERENCE_INTERVALS, THRESHOLDS, interpret, validateAll, validateValue, type ClinicalContext, type TegValues } from "./teg-algorithm";
const normal: TegValues = { CK_R: 6, CKH_R: 6, CRT_MA: 60, CFF_MA: 22, CK_LY30: 1 };
const active: ClinicalContext = { ...EMPTY_CONTEXT, adultConfirmed: true, cartridgeConfirmed: true, bleeding: "active" };
const run = (patch: Partial<TegValues> = {}, context: ClinicalContext = active) => interpret({ ...normal, ...patch }, context);
const ids = (patch: Partial<TegValues>) => run(patch).recommendations.map(r => r.id);
describe("boundary validation", () => {
  it.each([null, undefined, [], "6", 6, {}, { CK_R: 6 }])("rejects malformed/omitted data %j", v => { const out = interpret(v, active); expect(out.errors.length).toBeGreaterThan(0); expect(out.recommendations).toEqual([]); });
  it.each(KEYS)("rejects invalid types for %s", key => { for (const value of [NaN, Infinity, -Infinity, "6", undefined, {}, true]) { const out = interpret({ ...normal, [key]: value }, active); expect(out.errors.length).toBeGreaterThan(0); expect(out.recommendations).toEqual([]); } });
  it.each(KEYS)("accepts inclusive plausible bounds and rejects outside %s", key => { const [lo, hi] = PLAUSIBLE[key]; expect(validateValue(key, lo)).toBeNull(); expect(validateValue(key, hi)).toBeNull(); for (const value of [lo - 0.1, hi + 0.1, -1]) { expect(validateValue(key, value)?.severity).toBe("error"); expect(interpret({ ...normal, [key]: value }, active).recommendations).toEqual([]); } });
  it("blocks empty and unexpected keys", () => { expect(interpret(EMPTY_VALUES, active).errors.length).toBeGreaterThan(0); expect(interpret({ ...normal, A10: 17 }, active).recommendations).toEqual([]); });
  it.each([{}, null, "pregnant", { ...active, bleeding: "invalid" }])("rejects malformed context %j", c => expect(interpret(normal, c).recommendations).toEqual([]));
  it("requires adult and cartridge", () => { for (const c of [{ ...active, adultConfirmed: false }, { ...active, cartridgeConfirmed: false }]) expect(interpret(normal, c).recommendations).toEqual([]); });
});
describe("source intervals and contexts", () => {
  it("uses revision AB intervals separately from illustrative thresholds", () => { expect(REFERENCE_INTERVALS.CKH_R).toEqual([4.3, 8.3]); expect(REFERENCE_INTERVALS.CK_LY30).toEqual([0, 2.6]); expect(REFERENCE_INTERVALS.CFF_MA).toEqual([13, 30]); expect(THRESHOLDS.pregnant).toBeNull(); });
  it.each(["unknown", "not-bleeding"] as const)("never gives product actions with %s bleeding", bleeding => { const out = run({ CK_R: 16, CKH_R: 12, CRT_MA: 40, CFF_MA: 8, CK_LY30: 10 }, { ...active, bleeding }); expect(out.recommendations.every(r => r.severity === "info" && r.dose === "—")).toBe(true); });
  it.each(["pregnant", "standard"] as const)("PPH and obstetric context have no automated products (%s)", population => { const out = run({ CK_R: 16, CKH_R: 12, CRT_MA: 40, CFF_MA: 8 }, { ...active, population, indication: "pph" }); expect(out.recommendations.every(r => r.severity === "info")).toBe(true); });
  it("pregnancy alone does not create PPH TXA guidance", () => { const out = run({}, { ...active, population: "pregnant" }); expect(out.guidance.some(g => g.startsWith("For confirmed"))).toBe(false); });
  it.each(["trauma", "pph"] as const)("TXA context guidance independent of LY30 (%s)", indication => { for (const CK_LY30 of [0, 10, null]) { const out = run({ CK_LY30 }, { ...active, indication, withinThreeHours: "yes" }); expect(out.guidance.some(g => g.startsWith("For confirmed"))).toBe(true); expect(out.recommendations.every(r => r.dose === "—")).toBe(true); } });
  it.each(["no", "unknown"] as const)("no automatic TXA with timing %s", withinThreeHours => { const out = run({ CK_LY30: 10 }, { ...active, indication: "trauma", withinThreeHours }); expect(out.guidance.some(g => g.startsWith("For confirmed"))).toBe(false); });
});
describe("illustrative rules and unavailable assessments", () => {
  it("no trigger does not declare normal haemostasis", () => { expect(ids({})).toEqual(["none"]); const out = run({ CK_R: 3, CRT_MA: 80, CFF_MA: 40, CK_LY30: 2.8 }); expect(out.recommendations.map(r => r.id)).toEqual(["none"]); expect(out.abnormal.map(a => a.key)).toEqual(["CK_R", "CRT_MA", "CFF_MA", "CK_LY30"]); });
  it("heparin-suggestive correction suppresses plasma but never doses protamine", () => { expect(ids({ CK_R: 14, CKH_R: 6 })).toEqual(["protamine"]); expect(run({ CK_R: 14, CKH_R: 6 }).recommendations[0]?.severity).toBe("info"); });
  it("residual prolonged CKH adds clinical plasma consideration", () => expect(ids({ CK_R: 16, CKH_R: 12 })).toEqual(["protamine", "ffp"]));
  it("missing CKH cannot establish absence of heparin or advise plasma", () => { const out = run({ CK_R: 14, CKH_R: null }); expect(out.recommendations[0]?.severity).toBe("info"); expect(out.unavailable.length).toBe(1); });
  it("both low MA preserve both findings, without platelet action", () => { const out = run({ CFF_MA: 8, CRT_MA: 40 }); expect(out.recommendations.map(r => r.id)).toEqual(["cryo", "platelets"]); expect(out.recommendations.find(r => r.id === "platelets")?.severity).toBe("info"); });
  it("adequate fibrin permits conditional platelet consideration", () => expect(run({ CRT_MA: 40 }).recommendations[0]?.severity).toBe("action"));
  it("missing CFF cannot isolate platelet deficit", () => expect(run({ CRT_MA: 40, CFF_MA: null }).recommendations[0]?.severity).toBe("info"));
  it("elevated LY30 never prescribes TXA", () => { const rec = run({ CK_LY30: 10 }).recommendations[0]; expect(rec?.id).toBe("lysis"); expect(rec?.severity).toBe("info"); expect(rec?.dose).toBe("—"); });
  it("strict trigger boundaries", () => { expect(ids({ CK_R: 10, CKH_R: 10, CRT_MA: 52, CFF_MA: 15, CK_LY30: 3 })).toEqual(["none"]); expect(ids({ CK_R: 13, CKH_R: 11 })).not.toContain("protamine"); });
  it.each(KEYS)("lists unavailable assessment for %s", key => { const out = run({ [key]: null }); expect(out.missing).toContain(key); expect(out.unavailable.length).toBe(1); });
  it("warnings suppress product action", () => { const out = run({ CK_R: 12, CKH_R: 15, CRT_MA: 40, CFF_MA: 45 }); expect(validateAll({ ...normal, CK_R: 12, CKH_R: 15, CRT_MA: 40, CFF_MA: 45 })).toHaveLength(2); expect(out.recommendations.every(r => r.severity === "info")).toBe(true); });
  it("cross-field boundary 2 minutes is not warning", () => expect(validateAll({ ...normal, CKH_R: 8 })).toEqual([]));
});
