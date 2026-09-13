// TEG 6s Global Hemostasis cartridge interpretation rules.
// Standard reference ranges based on Haemonetics TEG 6s operator manual cutoffs.
// Pregnancy (third-trimester) reference ranges derived from published TEG 6s
// peripartum cohorts (e.g. de Lange et al. 2014, Gillissen et al. 2019) — see
// CITATION below. This is a transparent, auditable rule engine.

export type TegValues = {
  CK_R: number | null; // Citrated Kaolin R time (min)
  CKH_R: number | null; // Citrated Kaolin + Heparinase R time (min)
  CRT_MA: number | null; // Citrated RapidTEG MA (mm)
  CFF_MA: number | null; // Citrated Functional Fibrinogen MA (mm)
  CK_LY30: number | null; // % lysis at 30 min from CK channel
};

export type Population = "standard" | "pregnant";

type ParamMeta = {
  label: string;
  unit: string;
  normal: string;
  description: string;
};

// Empty-values sentinel — lives with the schema, not the store, so any
// caller (extractor, store, UI) can share the same shape.
export const EMPTY_VALUES: TegValues = {
  CK_R: null,
  CKH_R: null,
  CRT_MA: null,
  CFF_MA: null,
  CK_LY30: null,
};

// Plausibility bounds only — decoupled from PARAM_META so the OCR scrubber
// doesn't have to reach into UI copy.
export const PLAUSIBLE: Record<keyof TegValues, readonly [number, number]> = {
  CK_R: [0.5, 60],
  CKH_R: [0.5, 60],
  CRT_MA: [0, 100],
  CFF_MA: [0, 60],
  CK_LY30: [0, 100],
};

const STANDARD_META: Record<keyof TegValues, ParamMeta> = {
  CK_R: {
    label: "CK.R",
    unit: "min",
    normal: "4.6 – 9.1",
    description: "Citrated Kaolin reaction time — clotting factor activity",
  },
  CKH_R: {
    label: "CKH.R",
    unit: "min",
    normal: "4.6 – 9.1",
    description: "Kaolin + Heparinase R — compared to CK.R to detect heparin",
  },
  CRT_MA: {
    label: "CRT.MA",
    unit: "mm",
    normal: "52 – 70",
    description: "RapidTEG maximum amplitude — overall clot strength (platelets)",
  },
  CFF_MA: {
    label: "CFF.MA",
    unit: "mm",
    normal: "15 – 32",
    description: "Functional Fibrinogen MA — fibrinogen contribution",
  },
  CK_LY30: {
    label: "CK.LY30",
    unit: "%",
    normal: "< 3",
    description: "Percent lysis at 30 minutes — fibrinolysis",
  },
};

// Third-trimester / peripartum reference ranges. Pregnancy is a
// hypercoagulable state: fibrinogen rises, MA increases, R shortens slightly.
const PREGNANT_META: Record<keyof TegValues, ParamMeta> = {
  CK_R: { ...STANDARD_META.CK_R, normal: "4.6 – 8.7" },
  CKH_R: { ...STANDARD_META.CKH_R, normal: "4.6 – 8.7" },
  CRT_MA: { ...STANDARD_META.CRT_MA, normal: "60 – 73" },
  CFF_MA: { ...STANDARD_META.CFF_MA, normal: "18 – 41" },
  CK_LY30: { ...STANDARD_META.CK_LY30, normal: "< 2.6" },
};

export function getParamMeta(
  population: Population = "standard",
): Record<keyof TegValues, ParamMeta> {
  return population === "pregnant" ? PREGNANT_META : STANDARD_META;
}

// Back-compat export so existing imports continue to work (standard ranges).
export const PARAM_META = STANDARD_META;

// Decision thresholds — also adjusted in pregnancy.
type Thresholds = {
  R_prolonged: number; // min — triggers FFP
  heparin_delta: number; // min — CK.R − CKH.R for protamine
  fib_low: number; // mm — CFF.MA below this triggers cryo/fibrinogen
  platelet_low: number; // mm — CRT.MA below this (with adequate fib) triggers platelets
  ly30_high: number; // % — triggers antifibrinolytic
};

const STANDARD_TH: Thresholds = {
  R_prolonged: 10,
  heparin_delta: 2,
  fib_low: 15,
  platelet_low: 52,
  ly30_high: 3,
};

// Peripartum thresholds reflect higher physiological fibrinogen and MA, and
// the PPH literature targeting fibrinogen ≳ 2 g/L (CFF.MA ≈ 20 mm).
const PREGNANT_TH: Thresholds = {
  R_prolonged: 9,
  heparin_delta: 2,
  fib_low: 20,
  platelet_low: 55,
  ly30_high: 2.6,
};

function thresholdsFor(population: Population): Thresholds {
  return population === "pregnant" ? PREGNANT_TH : STANDARD_TH;
}

export type ValueIssue = {
  key: keyof TegValues;
  severity: "error" | "warning";
  message: string;
};

export function validateValue(
  key: keyof TegValues,
  value: number | null,
): ValueIssue | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) {
    return { key, severity: "error", message: "Not a finite number." };
  }
  if (value < 0) {
    return { key, severity: "error", message: "Negative value is not possible." };
  }
  const meta = STANDARD_META[key];
  const [lo, hi] = PLAUSIBLE[key];
  if (value < lo || value > hi) {
    return {
      key,
      severity: "error",
      message: `Outside plausible range (${lo}–${hi} ${meta.unit}). Likely OCR or unit error — please re-enter.`,
    };
  }
  return null;
}

export function validateAll(v: TegValues): ValueIssue[] {
  const issues: ValueIssue[] = [];
  (Object.keys(STANDARD_META) as (keyof TegValues)[]).forEach((k) => {
    const i = validateValue(k, v[k]);
    if (i) issues.push(i);
  });

  if (v.CK_R !== null && v.CKH_R !== null && v.CKH_R - v.CK_R > 2) {
    issues.push({
      key: "CKH_R",
      severity: "warning",
      message: `CKH.R (${v.CKH_R}) is more than 2 min longer than CK.R (${v.CK_R}) — adding heparinase should not prolong R. Please re-check.`,
    });
  }
  if (v.CFF_MA !== null && v.CRT_MA !== null && v.CFF_MA > v.CRT_MA) {
    issues.push({
      key: "CFF_MA",
      severity: "warning",
      message: `CFF.MA (${v.CFF_MA}) exceeds CRT.MA (${v.CRT_MA}) — physiologically unexpected.`,
    });
  }
  return issues;
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

export function interpret(
  v: TegValues,
  population: Population = "standard",
): {
  recommendations: Recommendation[];
  missing: (keyof TegValues)[];
  population: Population;
} {
  const th = thresholdsFor(population);
  const recs: Recommendation[] = [];
  const missing = (Object.keys(v) as (keyof TegValues)[]).filter(
    (k) => v[k] === null,
  );

  // Small helper — avoids string-concatenating optional context onto every
  // rationale by hand (easy to forget, easy to double-space).
  const rationale = (base: string, pregnancyOnly?: string) =>
    population === "pregnant" && pregnancyOnly
      ? `${base} ${pregnancyOnly}`
      : base;
  const pregNote = " Pregnancy-adjusted threshold (third-trimester physiology).";


  // Heparin effect: a prolonged CK.R that corrects with heparinase (CKH.R)
  // is caused by circulating heparin, not factor deficiency — so it calls for
  // protamine and NOT for FFP. The two rules below are therefore mutually
  // exclusive (this also matches the published decision tree diagram).
  const heparinEffect =
    v.CK_R !== null &&
    v.CKH_R !== null &&
    v.CK_R > th.R_prolonged &&
    v.CK_R - v.CKH_R > th.heparin_delta;

  // 1. Prolonged CK.R not explained by heparin → FFP
  if (v.CK_R !== null && v.CK_R > th.R_prolonged && !heparinEffect) {
    recs.push({
      id: "ffp",
      severity: "action",
      finding: "Prolonged CK.R (coagulation factor deficiency)",
      trigger: `CK.R = ${v.CK_R} min (> ${th.R_prolonged} min)`,
      product: "Fresh Frozen Plasma (FFP)",
      dose: "10–15 mL/kg",
      rationale: rationale(
        "Prolonged R time on the kaolin channel reflects deficiency of clotting factors; FFP replaces factors.",
        pregNote.trim(),
      ),
    });
  }

  // 2. Heparin effect → Protamine
  if (
    v.CK_R !== null &&
    v.CKH_R !== null &&
    v.CK_R > th.R_prolonged &&
    v.CK_R - v.CKH_R > th.heparin_delta
  ) {
    recs.push({
      id: "protamine",
      severity: "action",
      finding: "Residual heparin effect",
      trigger: `CK.R − CKH.R = ${(v.CK_R - v.CKH_R).toFixed(1)} min (> ${th.heparin_delta} min) with prolonged CK.R`,
      product: "Protamine sulfate",
      dose: "Dose per institutional protocol (typically 25–50 mg test dose)",
      rationale:
        "A CK.R that normalises when heparinase is added (CKH.R) indicates the prolongation is due to circulating heparin rather than factor deficiency.",
    });
  }

  // 3. Low CFF.MA → Cryoprecipitate / fibrinogen concentrate
  if (v.CFF_MA !== null && v.CFF_MA < th.fib_low) {
    recs.push({
      id: "cryo",
      severity: "action",
      finding: "Hypofibrinogenaemia",
      trigger: `CFF.MA = ${v.CFF_MA} mm (< ${th.fib_low} mm)`,
      product: "Cryoprecipitate or fibrinogen concentrate",
      dose: "Cryoprecipitate 1 unit / 10 kg, or fibrinogen concentrate 25–50 mg/kg",
      rationale: rationale(
        "Low Functional Fibrinogen MA indicates insufficient fibrinogen for clot formation.",
        "In the peripartum setting, fibrinogen ≳ 2 g/L (CFF.MA ≈ 20 mm) is commonly targeted because PPH risk rises sharply below this level.",
      ),
    });
  }

  // 4. Low CRT.MA with adequate fibrinogen → Platelets
  if (
    v.CRT_MA !== null &&
    v.CRT_MA < th.platelet_low &&
    v.CFF_MA !== null &&
    v.CFF_MA >= th.fib_low
  ) {
    recs.push({
      id: "platelets",
      severity: "action",
      finding: "Reduced platelet contribution to clot strength",
      trigger: `CRT.MA = ${v.CRT_MA} mm (< ${th.platelet_low} mm) with CFF.MA ≥ ${th.fib_low} mm`,
      product: "Platelets",
      dose: "1 adult therapeutic dose (≈1 apheresis unit or pool of 4–6)",
      rationale: rationale(
        "Low overall MA with adequate fibrinogen MA isolates the deficit to platelet number/function.",
        pregNote.trim(),
      ),
    });
  }

  // 5. Hyperfibrinolysis → Antifibrinolytic
  if (v.CK_LY30 !== null && v.CK_LY30 > th.ly30_high) {
    recs.push({
      id: "tranexamic",
      severity: "action",
      finding: "Hyperfibrinolysis",
      trigger: `CK.LY30 = ${v.CK_LY30}% (> ${th.ly30_high}%)`,
      product: "Tranexamic acid (antifibrinolytic)",
      dose:
        population === "pregnant"
          ? "1 g IV over 10 min (WOMAN trial regimen for PPH); repeat 1 g if bleeding continues after 30 min"
          : "1 g IV over 10 min, then 1 g over 8 h (CRASH-2 regimen) or per local protocol",
      rationale: rationale(
        "Elevated LY30 indicates accelerated clot breakdown.",
        "Pregnancy is normally hypofibrinolytic, so any rise above ~2.6% is more strongly suggestive of pathological fibrinolysis.",
      ),
    });
  }

  if (recs.length === 0 && missing.length === 0) {
    recs.push({
      id: "none",
      severity: "info",
      finding: "All parameters within reference range",
      trigger: "No threshold crossed",
      product: "No blood product indicated based on TEG",
      dose: "—",
      rationale: rationale(
        "TEG does not detect every cause of bleeding; correlate with the clinical picture and laboratory results.",
        "Pregnancy-adjusted ranges were applied.",
      ),
    });
  }

  return { recommendations: recs, missing, population };
}

export const CITATION =
  "Standard reference ranges: Haemonetics TEG 6s Global Hemostasis cartridge operator manual. Pregnancy (third-trimester) reference ranges and peripartum thresholds derived from published TEG 6s obstetric cohorts (e.g. de Lange NM et al., Thromb Res 2014; Gillissen A et al., Anesth Analg 2019) and PPH guidance (RCOG Green-top 52; WOMAN trial). Always verify against your institutional protocol.";
