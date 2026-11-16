// Original TEG 6s Global Hemostasis cartridge only. Reference intervals are
// manufacturer intervals, NOT universal validated treatment thresholds.
export type TegValues = {
  CK_R: number | null;
  CKH_R: number | null;
  CRT_MA: number | null;
  CFF_MA: number | null;
  CK_LY30: number | null;
};
export type Population = "standard" | "pregnant";
export type ClinicalContext = {
  adultConfirmed: boolean;
  cartridgeConfirmed: boolean;
  population: Population;
  bleeding: "active" | "not-bleeding" | "unknown";
  indication: "other" | "trauma" | "pph";
  withinThreeHours: "yes" | "no" | "unknown";
};
export const EMPTY_CONTEXT: ClinicalContext = {
  adultConfirmed: false,
  cartridgeConfirmed: false,
  population: "standard",
  bleeding: "unknown",
  indication: "other",
  withinThreeHours: "unknown",
};
export const EMPTY_VALUES: TegValues = {
  CK_R: null,
  CKH_R: null,
  CRT_MA: null,
  CFF_MA: null,
  CK_LY30: null,
};
export const KEYS = Object.keys(EMPTY_VALUES) as (keyof TegValues)[];
export const PLAUSIBLE: Record<keyof TegValues, readonly [number, number]> = {
  CK_R: [0.5, 60],
  CKH_R: [0.5, 60],
  CRT_MA: [0, 100],
  CFF_MA: [0, 60],
  CK_LY30: [0, 100],
};
export const REFERENCE_INTERVALS: Record<keyof TegValues, readonly [number, number]> = {
  CK_R: [4.6, 9.1],
  CKH_R: [4.3, 8.3],
  CRT_MA: [52, 70],
  CFF_MA: [15, 32],
  CK_LY30: [0, 2.6],
};
export const PARAM_META = {
  CK_R: {
    label: "CK.R",
    unit: "min",
    normal: "4.6 – 9.1",
    description: "Kaolin reaction time; multiple causes of prolongation",
  },
  CKH_R: {
    label: "CKH.R",
    unit: "min",
    normal: "4.3 – 8.3",
    description: "Heparinase reaction time; compare with CK.R",
  },
  CRT_MA: {
    label: "CRT.MA",
    unit: "mm",
    normal: "52 – 70",
    description: "Overall clot strength; platelet and fibrin contributions",
  },
  CFF_MA: {
    label: "CFF.MA",
    unit: "mm",
    normal: "15 – 32",
    description: "Functional fibrin contribution; not a fibrinogen concentration",
  },
  CK_LY30: {
    label: "CK.LY30",
    unit: "%",
    normal: "0 – 2.6",
    description: "Observed lysis; normal LY30 does not exclude fibrinolysis",
  },
};
export function getParamMeta(population: Population = "standard") {
  return population === "pregnant"
    ? (Object.fromEntries(
        KEYS.map((k) => [
          k,
          { ...PARAM_META[k], normal: "No validated local obstetric interval configured" },
        ]),
      ) as typeof PARAM_META)
    : PARAM_META;
}
// Retained adult illustrative triggers, not a locally validated transfusion protocol.
export const THRESHOLDS = {
  standard: { R_prolonged: 10, heparin_delta: 2, fib_low: 15, platelet_low: 52, ly30_high: 3 },
  pregnant: null,
};
export type ValueIssue = { key: keyof TegValues; severity: "error" | "warning"; message: string };
export function validateValue(key: keyof TegValues, value: unknown): ValueIssue | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    return {
      key,
      severity: "error",
      message: "A finite numeric value or explicit blank is required.",
    };
  const [lo, hi] = PLAUSIBLE[key];
  return value < lo || value > hi
    ? {
        key,
        severity: "error",
        message: `Outside plausible input bounds (${lo}–${hi} ${PARAM_META[key].unit}); re-check display, channel and units.`,
      }
    : null;
}
export function validateAll(input: unknown): ValueIssue[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return [{ key: "CK_R", severity: "error", message: "Malformed result set." }];
  const v = input as Record<string, unknown>;
  const issues = KEYS.flatMap((k) => {
    const issue = validateValue(k, Object.hasOwn(v, k) ? v[k] : undefined);
    return issue ? [issue] : [];
  });
  if (Object.keys(v).some((k) => !KEYS.includes(k as keyof TegValues)))
    issues.push({ key: "CK_R", severity: "error", message: "Unexpected parameters or channels." });
  if (issues.some((i) => i.severity === "error")) return issues;
  const valid = v as TegValues;
  if (valid.CK_R !== null && valid.CKH_R !== null && valid.CKH_R - valid.CK_R > 2)
    issues.push({
      key: "CKH_R",
      severity: "warning",
      message: "CKH.R is more than 2 min longer than CK.R; re-check sample and readings.",
    });
  if (valid.CFF_MA !== null && valid.CRT_MA !== null && valid.CFF_MA > valid.CRT_MA)
    issues.push({
      key: "CFF_MA",
      severity: "warning",
      message: "CFF.MA exceeds CRT.MA; unexpected channel relationship, re-check.",
    });
  return issues;
}
export function validContext(input: unknown): input is ClinicalContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const c = input as ClinicalContext;
  return (
    Object.keys(c).length === 6 &&
    typeof c.adultConfirmed === "boolean" &&
    typeof c.cartridgeConfirmed === "boolean" &&
    ["standard", "pregnant"].includes(c.population) &&
    ["active", "not-bleeding", "unknown"].includes(c.bleeding) &&
    ["other", "trauma", "pph"].includes(c.indication) &&
    ["yes", "no", "unknown"].includes(c.withinThreeHours)
  );
}
export type Recommendation = {
  id: string;
  severity: "action" | "info";
  finding: string;
  trigger: string;
  product: string;
  dose: string;
  rationale: string;
};
export const RULES = [
  {
    id: "ffp",
    reference: "rule-ffp",
    finding: "Prolonged reaction time",
    condition:
      "CK.R > 10 min; CKH.R required. Plasma consideration only if CKH.R > 10, or delta ≤ 2 min.",
    rationale:
      "Prolongation may reflect anticoagulants, factor abnormalities or other causes, not proven factor deficiency. Missing CKH.R cannot exclude heparin. Correlate PT/APTT, exposure and local reversal protocols.",
  },
  {
    id: "protamine",
    reference: "rule-protamine",
    finding: "Suspected heparin effect",
    condition: "CK.R > 10 min AND CK.R − CKH.R > 2 min.",
    rationale:
      "Suggestive, not definitive: consider heparin exposure and sample contamination. Protamine dose depends on actual heparin amount, type and elapsed time, never delta R; use the SmPC and local reversal protocol.",
  },
  {
    id: "cryo",
    reference: "rule-cryo",
    finding: "Reduced functional fibrin contribution",
    condition: "CFF.MA < 15 mm.",
    rationale:
      "Suggestive, not an isolated diagnosis of hypofibrinogenaemia. Correlate Clauss fibrinogen. No universal conversion of CFF.MA to g/L or pooled cryoprecipitate units/kg.",
  },
  {
    id: "platelets",
    reference: "rule-platelets",
    finding: "Reduced overall clot strength",
    condition: "CRT.MA < 52 mm; CFF.MA required for contribution assessment.",
    rationale:
      "Platelet number/function and fibrin deficits can coexist. Check platelet count/function; reassess count and MA after fibrinogen correction. Adequate CFF.MA does not isolate a platelet diagnosis.",
  },
  {
    id: "lysis",
    reference: "rule-txa",
    finding: "Increased observed lysis",
    condition: "CK.LY30 > 3% (illustrative); reference interval ends at 2.6%.",
    rationale:
      "Correlate clinically. Normal LY30 does not exclude clinically important fibrinolysis. Elevated LY30 alone is not a universal TXA indication.",
  },
];
export const NO_THRESHOLD =
  "No configured threshold crossed; this does not establish normal haemostasis or exclude bleeding";
export function interpret(input: unknown, context: unknown = EMPTY_CONTEXT) {
  const issues = validateAll(input);
  const recommendations: Recommendation[] = [];
  const missing: (keyof TegValues)[] = [];
  const abnormal: { key: keyof TegValues; direction: "low" | "high"; value: number }[] = [];
  const unavailable: string[] = [];
  const guidance: string[] = [];
  const errors = issues.filter((i) => i.severity === "error").map((i) => i.message);
  if (!validContext(context)) errors.push("Invalid clinical context.");
  const base = {
    recommendations,
    missing,
    abnormal,
    unavailable,
    guidance,
    issues,
    errors,
    population: validContext(context) ? context.population : ("standard" as Population),
  };
  if (errors.length || !validContext(context)) return base;
  const v = input as TegValues;
  missing.push(...KEYS.filter((k) => v[k] === null));
  if (missing.length === KEYS.length) {
    errors.push("Enter at least one completed parameter.");
    return base;
  }
  if (!context.adultConfirmed || !context.cartridgeConfirmed) {
    errors.push(
      "Confirm adult patient and original Global Hemostasis cartridge (CK, CKH, CRT, CFF). Other devices/cartridges are out of scope.",
    );
    return base;
  }
  guidance.push(
    "If major haemorrhage is suspected, escalate and activate the local major haemorrhage protocol immediately; do not wait for complete TEG results.",
  );
  guidance.push(
    "Normal LY30 does not exclude clinically important fibrinolysis. Reference intervals are not treatment thresholds.",
  );
  if (context.population === "pregnant" || context.indication === "pph")
    guidance.push(
      "No validated local obstetric algorithm configured. Findings require obstetric/laboratory correlation; no automated blood product or dose decisions. Pregnancy alone is not postpartum haemorrhage. Published TEG6s obstetric CFF A10 ≤17 mm is NOT MA and is not used here.",
    );
  if (context.bleeding !== "active")
    guidance.push(
      "Bleeding is absent or unknown: abnormal numbers alone must not trigger transfusion or dose instructions.",
    );
  if (context.indication === "trauma" || context.indication === "pph") {
    const event = context.indication === "trauma" ? "injury" : "birth";
    if (context.bleeding === "active" && context.withinThreeHours === "yes")
      guidance.push(
        `For confirmed ${context.indication === "trauma" ? "bleeding trauma" : "postpartum haemorrhage"} within 3 hours of ${event}, use indication-specific TXA guidance and local protocol promptly; do not await viscoelastic testing. No dose is calculated here.`,
      );
    else
      guidance.push(
        `TXA requires indication and timing assessment: ${context.indication === "trauma" ? "trauma" : "PPH"} guidance concerns treatment within 3 hours of ${event}. Timing ${context.withinThreeHours === "no" ? "is outside this window" : "or bleeding indication is not established"}; no automatic TXA instruction.`,
      );
  }
  for (const k of KEYS) {
    const value = v[k];
    if (value === null) {
      unavailable.push(
        `${PARAM_META[k].label} missing: ${k === "CKH_R" ? "heparin comparison and plasma branch unavailable; absence of heparin cannot be established" : k === "CFF_MA" ? "functional fibrin and platelet-contribution assessment unavailable" : k === "CRT_MA" ? "overall clot-strength assessment unavailable" : k === "CK_R" ? "reaction-time and heparin comparison unavailable" : "observed lysis assessment unavailable"}.`,
      );
      continue;
    }
    const [lo, hi] = REFERENCE_INTERVALS[k];
    if (value < lo || value > hi)
      abnormal.push({ key: k, value, direction: value < lo ? "low" : "high" });
  }
  if (abnormal.length)
    guidance.push(
      `${context.population === "pregnant" ? "Comparison with manufacturer non-obstetric intervals only, not validated obstetric ranges. " : ""}Short R or high MA is not a thrombosis diagnosis and does not justify anticoagulation.`,
    );
  const actionable =
    context.bleeding === "active" &&
    context.population === "standard" &&
    context.indication !== "pph" &&
    !issues.length;
  const add = (id: string, trigger: string, product?: string) => {
    const rule = RULES.find((r) => r.id === id);
    if (!rule) return;
    recommendations.push({
      id,
      severity: actionable && product ? "action" : "info",
      finding: rule.finding,
      trigger,
      product:
        actionable && product
          ? `Consider ${product} only under local major haemorrhage protocol and lab/clinical correlation`
          : "Interpretive finding — no automated product decision",
      dose: "—",
      rationale: rule.rationale,
    });
  };
  const th = THRESHOLDS.standard;
  if (v.CK_R !== null && v.CK_R > th.R_prolonged) {
    const hep = v.CKH_R !== null && v.CK_R - v.CKH_R > th.heparin_delta;
    if (hep)
      add("protamine", `CK.R − CKH.R > ${th.heparin_delta} min with CK.R > ${th.R_prolonged} min`); // No protamine instruction from TEG alone.
    if (!hep || (v.CKH_R !== null && v.CKH_R > th.R_prolonged))
      add(
        "ffp",
        `CK.R > ${th.R_prolonged} min${v.CKH_R === null ? "; CKH.R missing" : v.CKH_R > th.R_prolonged ? "; CKH.R also prolonged, other causes possible" : "; heparin comparison not suggestive by illustrative delta"}`,
        v.CKH_R === null ? undefined : "plasma",
      );
  }
  if (v.CFF_MA !== null && v.CFF_MA < th.fib_low)
    add("cryo", `CFF.MA < ${th.fib_low} mm`, "fibrinogen replacement");
  if (v.CRT_MA !== null && v.CRT_MA < th.platelet_low)
    add(
      "platelets",
      `CRT.MA < ${th.platelet_low} mm${v.CFF_MA === null ? "; CFF.MA missing" : v.CFF_MA < th.fib_low ? "; both MA low: fibrin and platelet deficits possible" : "; functional fibrin contribution not below illustrative threshold"}`,
      v.CFF_MA !== null && v.CFF_MA >= th.fib_low ? "platelets" : undefined,
    );
  if (v.CK_LY30 !== null && v.CK_LY30 > th.ly30_high) add("lysis", `CK.LY30 > ${th.ly30_high}%`);
  if (!recommendations.length)
    recommendations.push({
      id: "none",
      severity: "info",
      finding: NO_THRESHOLD,
      trigger: missing.length
        ? "Partial result set; unavailable assessments listed separately"
        : "No illustrative trigger crossed",
      product: "Clinical and laboratory correlation required",
      dose: "—",
      rationale:
        "No rule firing is not evidence that all parameters are normal or that no blood product is needed.",
    });
  return base;
}
export const INTERVAL_NOTE =
  "Source profile: original citrated multichannel cartridge REF 07-601 (CK/CKH/CRT/CFF), manufacturer insert PN 115873-MULTI(AC), February 2016, corroborated by RUH SOP/POCT/61/2 (10 November 2022). CFF.MA 15–32 mm; the older June 2015 revision AB manual illustrates 13–30 mm. This is a versioned source profile, not confirmation of the latest regional IFU. Verify the actual cartridge IFU and locally validated laboratory intervals; not HN or other cartridges. A10 is not MA.";
export const CITATION =
  "Reference profile: manufacturer original cartridge REF 07-601 insert revision AC (2016), corroborated by RUH SOP (2022); verify current regional IFU/local intervals. Older revision AB manual screenshot differs for CFF.MA. Adult triggers here are illustrative, not universal validated treatment cutoffs. No validated local obstetric algorithm configured. Guidelines support clinical management, not validation of this numeric rule ladder.";
