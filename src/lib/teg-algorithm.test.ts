import { describe, expect, it } from "vitest";
import {
  EMPTY_VALUES,
  PLAUSIBLE,
  THRESHOLDS,
  interpret,
  validateAll,
  validateValue,
  type Population,
  type TegValues,
} from "./teg-algorithm";

const A = THRESHOLDS.standard;
const P = THRESHOLDS.pregnant;

// A result set that fires no rule under the standard thresholds.
const NORMAL: TegValues = {
  CK_R: 6,
  CKH_R: 6,
  CRT_MA: 60,
  CFF_MA: 22,
  CK_LY30: 1,
};

// Pregnancy thresholds are stricter (higher MA floors), so the "all normal"
// case needs its own baseline.
const NORMAL_PREGNANT: TegValues = {
  CK_R: 6,
  CKH_R: 6,
  CRT_MA: 65,
  CFF_MA: 30,
  CK_LY30: 1,
};

function withValues(patch: Partial<TegValues>, base = NORMAL): TegValues {
  return { ...base, ...patch };
}

function ids(v: TegValues, population: Population = "standard") {
  return interpret(v, population).recommendations.map((r) => r.id);
}

const KEYS = Object.keys(EMPTY_VALUES) as (keyof TegValues)[];

describe("interpret — no rule fires", () => {
  it("returns the 'none' info card when every value is normal", () => {
    const out = interpret(NORMAL);
    expect(out.recommendations).toHaveLength(1);
    expect(out.recommendations[0]!.id).toBe("none");
    expect(out.recommendations[0]!.severity).toBe("info");
    expect(out.missing).toEqual([]);
    expect(out.population).toBe("standard");
  });

  it("returns the 'none' card for pregnancy-normal values", () => {
    expect(ids(NORMAL_PREGNANT, "pregnant")).toEqual(["none"]);
  });

  it("does not emit the 'none' card when a value is missing", () => {
    const out = interpret(withValues({ CFF_MA: null }));
    expect(out.recommendations).toEqual([]);
    expect(out.missing).toEqual(["CFF_MA"]);
  });

  it("reports every missing key when nothing is entered", () => {
    const out = interpret(EMPTY_VALUES);
    expect(out.missing.sort()).toEqual([...KEYS].sort());
    expect(out.recommendations).toEqual([]);
  });
});

describe("rule 1 — prolonged CK.R → FFP", () => {
  it("fires above the adult threshold", () => {
    expect(ids(withValues({ CK_R: A.R_prolonged + 1, CKH_R: A.R_prolonged + 1 }))).toContain("ffp");
  });

  it("does not fire exactly at the threshold (strict >)", () => {
    expect(ids(withValues({ CK_R: A.R_prolonged, CKH_R: A.R_prolonged }))).not.toContain("ffp");
  });

  it("does not fire when CK.R is null", () => {
    expect(ids(withValues({ CK_R: null }))).not.toContain("ffp");
  });

  it("is suppressed when heparin fully explains the prolongation", () => {
    const out = ids(withValues({ CK_R: 14, CKH_R: 6 }));
    expect(out).toContain("protamine");
    expect(out).not.toContain("ffp");
  });

  it("still fires when the heparinase channel is also prolonged", () => {
    const out = ids(withValues({ CK_R: 16, CKH_R: 12 }));
    expect(out).toContain("protamine");
    expect(out).toContain("ffp");
  });

  it("uses the lower pregnancy threshold", () => {
    const v = withValues({ CK_R: 9.5, CKH_R: 9.5 }, NORMAL_PREGNANT);
    expect(ids(v, "pregnant")).toContain("ffp");
    expect(ids(v, "standard")).not.toContain("ffp");
    expect(P.R_prolonged).toBeLessThan(A.R_prolonged);
  });
});

describe("rule 2 — heparin effect → protamine", () => {
  it("fires when CK.R is prolonged and corrects with heparinase", () => {
    expect(ids(withValues({ CK_R: 13, CKH_R: 6 }))).toContain("protamine");
  });

  it("does not fire when the delta is at the threshold", () => {
    expect(
      ids(withValues({ CK_R: 13, CKH_R: 13 - A.heparin_delta })),
    ).not.toContain("protamine");
  });

  it("does not fire when CK.R itself is normal", () => {
    expect(ids(withValues({ CK_R: 8, CKH_R: 4.5 }))).not.toContain("protamine");
  });

  it("does not fire when CKH.R is missing", () => {
    expect(ids(withValues({ CK_R: 14, CKH_R: null }))).not.toContain("protamine");
  });
});

describe("rule 3 — low CFF.MA → cryoprecipitate", () => {
  it("fires below the adult fibrinogen floor", () => {
    expect(ids(withValues({ CFF_MA: A.fib_low - 1 }))).toContain("cryo");
  });

  it("does not fire exactly at the floor", () => {
    expect(ids(withValues({ CFF_MA: A.fib_low }))).not.toContain("cryo");
  });

  it("does not fire when CFF.MA is missing", () => {
    expect(ids(withValues({ CFF_MA: null }))).not.toContain("cryo");
  });

  it("uses the higher pregnancy floor", () => {
    const v = withValues({ CFF_MA: 18 }, NORMAL_PREGNANT);
    expect(ids(v, "pregnant")).toContain("cryo");
    expect(ids(v, "standard")).not.toContain("cryo");
  });

  it("adds the peripartum fibrinogen rationale in pregnancy", () => {
    const rec = interpret(
      withValues({ CFF_MA: 10 }, NORMAL_PREGNANT),
      "pregnant",
    ).recommendations.find((r) => r.id === "cryo");
    expect(rec?.rationale).toMatch(/peripartum/i);
  });
});

describe("rule 4 — low CRT.MA with adequate fibrinogen → platelets", () => {
  it("fires when clot strength is low but fibrinogen is adequate", () => {
    expect(ids(withValues({ CRT_MA: A.platelet_low - 2 }))).toContain("platelets");
  });

  it("does not fire exactly at the threshold", () => {
    expect(ids(withValues({ CRT_MA: A.platelet_low }))).not.toContain("platelets");
  });

  it("is suppressed when fibrinogen is also low (cryo first)", () => {
    const out = ids(withValues({ CRT_MA: 40, CFF_MA: 8 }));
    expect(out).toContain("cryo");
    expect(out).not.toContain("platelets");
  });

  it("does not fire when either input is missing", () => {
    expect(ids(withValues({ CRT_MA: null }))).not.toContain("platelets");
    expect(ids(withValues({ CRT_MA: 40, CFF_MA: null }))).not.toContain("platelets");
  });

  it("uses the higher pregnancy MA floor", () => {
    const v = withValues({ CRT_MA: 53 }, NORMAL_PREGNANT);
    expect(ids(v, "pregnant")).toContain("platelets");
    expect(ids(v, "standard")).not.toContain("platelets");
  });
});

describe("rule 5 — elevated LY30 → tranexamic acid", () => {
  it("fires above the adult lysis threshold", () => {
    expect(ids(withValues({ CK_LY30: A.ly30_high + 0.5 }))).toContain("tranexamic");
  });

  it("does not fire exactly at the threshold", () => {
    expect(ids(withValues({ CK_LY30: A.ly30_high }))).not.toContain("tranexamic");
  });

  it("does not fire when LY30 is missing", () => {
    expect(ids(withValues({ CK_LY30: null }))).not.toContain("tranexamic");
  });

  it("uses the lower pregnancy threshold and the WOMAN regimen", () => {
    const v = withValues({ CK_LY30: 2.8 }, NORMAL_PREGNANT);
    expect(ids(v, "pregnant")).toContain("tranexamic");
    expect(ids(v, "standard")).not.toContain("tranexamic");
    const rec = interpret(v, "pregnant").recommendations.find(
      (r) => r.id === "tranexamic",
    );
    expect(rec?.dose).toMatch(/WOMAN/);
  });
});

describe("interpret — combinations", () => {
  it("fires multiple independent rules at once", () => {
    const out = ids(
      withValues({ CK_R: 15, CKH_R: 14, CFF_MA: 9, CK_LY30: 12 }),
    );
    expect(out).toEqual(
      expect.arrayContaining(["ffp", "protamine", "cryo", "tranexamic"]),
    );
    expect(out).not.toContain("none");
  });

  it("defaults to the standard population", () => {
    expect(interpret(NORMAL).population).toBe("standard");
  });
});

describe("validateValue — plausible bounds", () => {
  it.each(KEYS)("accepts values inside the %s bounds", (key) => {
    const [lo, hi] = PLAUSIBLE[key];
    expect(validateValue(key, lo)).toBeNull();
    expect(validateValue(key, hi)).toBeNull();
    expect(validateValue(key, (lo + hi) / 2)).toBeNull();
  });

  it.each(KEYS)("rejects values outside the %s bounds", (key) => {
    const [lo, hi] = PLAUSIBLE[key];
    expect(validateValue(key, hi + 1)?.severity).toBe("error");
    if (lo > 0) expect(validateValue(key, lo - 0.1)?.severity).toBe("error");
  });

  it.each(KEYS)("rejects negative %s values", (key) => {
    expect(validateValue(key, -1)?.severity).toBe("error");
  });

  it("ignores nulls", () => {
    expect(validateValue("CK_R", null)).toBeNull();
  });

  it("rejects non-finite numbers", () => {
    expect(validateValue("CK_R", Number.NaN)?.message).toMatch(/finite/i);
    expect(validateValue("CK_R", Infinity)?.severity).toBe("error");
  });
});

describe("validateAll — cross-field checks", () => {
  it("returns nothing for a plausible result set", () => {
    expect(validateAll(NORMAL)).toEqual([]);
  });

  it("returns nothing for an empty result set", () => {
    expect(validateAll(EMPTY_VALUES)).toEqual([]);
  });

  it("collects one error per out-of-bounds value", () => {
    const issues = validateAll(
      withValues({ CK_R: 999, CFF_MA: 500, CK_LY30: 1000 }),
    );
    expect(issues.filter((i) => i.severity === "error").map((i) => i.key).sort()).toEqual(
      ["CFF_MA", "CK_LY30", "CK_R"],
    );
  });

  it("warns when heparinase prolongs R by more than 2 min", () => {
    const issues = validateAll(withValues({ CK_R: 6, CKH_R: 9 }));
    expect(issues).toContainEqual(
      expect.objectContaining({ key: "CKH_R", severity: "warning" }),
    );
  });

  it("does not warn at exactly 2 min of heparinase difference", () => {
    expect(validateAll(withValues({ CK_R: 6, CKH_R: 8 }))).toEqual([]);
  });

  it("warns when CFF.MA exceeds CRT.MA", () => {
    const issues = validateAll(withValues({ CRT_MA: 55, CFF_MA: 58 }));
    expect(issues).toContainEqual(
      expect.objectContaining({ key: "CFF_MA", severity: "warning" }),
    );
  });

  it("does not run cross-field checks when a partner value is missing", () => {
    expect(validateAll(withValues({ CKH_R: null, CFF_MA: null }))).toEqual([]);
  });
});
