// TEG 6s Global Hemostasis cartridge interpretation rules.
// Reference ranges based on Haemonetics TEG 6s operator manual cutoffs.
// This is a transparent, auditable rule engine — no AI in the decision path.

export type TegValues = {
  CK_R: number | null; // Citrated Kaolin R time (min)
  CKH_R: number | null; // Citrated Kaolin + Heparinase R time (min)
  CRT_MA: number | null; // Citrated RapidTEG MA (mm)
  CFF_MA: number | null; // Citrated Functional Fibrinogen MA (mm)
  CK_LY30: number | null; // % lysis at 30 min from CK channel
};

export const PARAM_META: Record<
  keyof TegValues,
  { label: string; unit: string; normal: string; description: string }
> = {
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

export type Recommendation = {
  id: string;
  severity: "action" | "info";
  finding: string;
  trigger: string;
  product: string;
  dose: string;
  rationale: string;
};

export function interpret(v: TegValues): {
  recommendations: Recommendation[];
  missing: (keyof TegValues)[];
} {
  const recs: Recommendation[] = [];
  const missing = (Object.keys(v) as (keyof TegValues)[]).filter(
    (k) => v[k] === null || Number.isNaN(v[k] as number),
  );

  // 1. Prolonged CK.R → FFP
  if (v.CK_R !== null && v.CK_R > 10) {
    recs.push({
      id: "ffp",
      severity: "action",
      finding: "Prolonged CK.R (coagulation factor deficiency)",
      trigger: `CK.R = ${v.CK_R} min (> 10 min)`,
      product: "Fresh Frozen Plasma (FFP)",
      dose: "10–15 mL/kg",
      rationale:
        "Prolonged R time on the kaolin channel reflects deficiency of clotting factors; FFP replaces factors.",
    });
  }

  // 2. Heparin effect → Protamine
  if (
    v.CK_R !== null &&
    v.CKH_R !== null &&
    v.CK_R > 10 &&
    v.CK_R - v.CKH_R > 2
  ) {
    recs.push({
      id: "protamine",
      severity: "action",
      finding: "Residual heparin effect",
      trigger: `CK.R − CKH.R = ${(v.CK_R - v.CKH_R).toFixed(1)} min (> 2 min) with prolonged CK.R`,
      product: "Protamine sulfate",
      dose: "Dose per institutional protocol (typically 25–50 mg test dose)",
      rationale:
        "A CK.R that normalises when heparinase is added (CKH.R) indicates the prolongation is due to circulating heparin rather than factor deficiency.",
    });
  }

  // 3. Low CFF.MA → Cryoprecipitate / fibrinogen concentrate
  if (v.CFF_MA !== null && v.CFF_MA < 15) {
    recs.push({
      id: "cryo",
      severity: "action",
      finding: "Hypofibrinogenaemia",
      trigger: `CFF.MA = ${v.CFF_MA} mm (< 15 mm)`,
      product: "Cryoprecipitate or fibrinogen concentrate",
      dose: "Cryoprecipitate 1 unit / 10 kg, or fibrinogen concentrate 25–50 mg/kg",
      rationale:
        "Low Functional Fibrinogen MA indicates insufficient fibrinogen for clot formation.",
    });
  }

  // 4. Low CRT.MA with adequate fibrinogen → Platelets
  if (
    v.CRT_MA !== null &&
    v.CRT_MA < 52 &&
    v.CFF_MA !== null &&
    v.CFF_MA >= 15
  ) {
    recs.push({
      id: "platelets",
      severity: "action",
      finding: "Reduced platelet contribution to clot strength",
      trigger: `CRT.MA = ${v.CRT_MA} mm (< 52 mm) with CFF.MA ≥ 15 mm`,
      product: "Platelets",
      dose: "1 adult therapeutic dose (≈1 apheresis unit or pool of 4–6)",
      rationale:
        "Low overall MA with adequate fibrinogen MA isolates the deficit to platelet number/function.",
    });
  }

  // 5. Hyperfibrinolysis → Antifibrinolytic
  if (v.CK_LY30 !== null && v.CK_LY30 > 3) {
    recs.push({
      id: "tranexamic",
      severity: "action",
      finding: "Hyperfibrinolysis",
      trigger: `CK.LY30 = ${v.CK_LY30}% (> 3%)`,
      product: "Tranexamic acid (antifibrinolytic)",
      dose: "1 g IV over 10 min, then 1 g over 8 h (CRASH-2 regimen) or per local protocol",
      rationale: "Elevated LY30 indicates accelerated clot breakdown.",
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
      rationale:
        "TEG does not detect every cause of bleeding; correlate with the clinical picture and laboratory results.",
    });
  }

  return { recommendations: recs, missing };
}

export const CITATION =
  "Reference ranges from Haemonetics TEG 6s Global Hemostasis cartridge operator manual. Algorithm thresholds based on commonly cited transfusion ladders for viscoelastic-guided haemostatic resuscitation. Verify against your institutional protocol.";
