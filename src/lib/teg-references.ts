// Source scope is explicit: clinical guidelines do not validate this illustrative
// TEG6s numeric ladder, and observational A10 evidence is not an MA rule.
export type Reference = {
  id: string;
  citation: string;
  url: string;
  supports: string[];
  limitation: string;
};
export const REFERENCES: Reference[] = [
  {
    id: "haemonetics-insert",
    citation:
      "Haemonetics. TEG 6s Citrated K, KH, RT, FF cartridge REF 07-601. PN 115873-MULTI(AC), February 2016, English pp5–6, Expected Values.",
    url: "https://www.ruh.nhs.uk/pathology/documents/poct/115873-MULTI_AC_CM_OUS_insert.pdf",
    supports: ["ranges-adult", "channel-definitions"],
    limitation:
      "Original cartridge: CK.R 4.6–9.1; CKH.R 4.3–8.3; CRT.MA 52–70; CFF.MA 15–32; CK.LY30 0–2.6. Versioned source, not verified latest regional IFU; use local laboratory validation. Reference intervals are not transfusion triggers.",
  },
  {
    id: "ruh-sop",
    citation:
      "Royal United Hospitals Bath. SOP/POCT/61/2: Haemonetics TEG6 POCT analyser. Effective 10 November 2022, section 7, p18.",
    url: "https://www.ruh.nhs.uk/pathology/documents/poct/TEG6_SOP_inc_algorithms.pdf",
    supports: ["ranges-adult", "channel-definitions"],
    limitation:
      "Corroborates CFF.MA 15–32 mm, separately lists CFF A10 15–30 mm. Local historical SOP, not universal treatment thresholds or proof of current IFU.",
  },
  {
    id: "haemonetics-manual",
    citation:
      "Haemonetics. TEG 6s User Manual. P/N 115191-IE, revision AB, June 2015. Figure 4-8 (p41), results description p42.",
    url: "https://www.ruh.nhs.uk/pathology/documents/poct/TEG6s_UserManual.pdf",
    supports: ["ranges-adult", "channel-definitions", "rule-protamine"],
    limitation:
      "Older illustrative screenshot, NOT the interval profile used by the engine: CK.R 4.6–9.1; CKH.R 4.3–8.3; CRT.MA 52–70; CFF.MA 13–30; CK.LY30 0–2.6. Not treatment triggers; check current cartridge IFU and local validation.",
  },
  {
    id: "roberts-2021",
    citation:
      "Roberts TCD, De Lloyd L, Bell SF, et al. Utility of viscoelastography with TEG 6s to direct management of haemostasis during obstetric haemorrhage: a prospective observational study. Int J Obstet Anesth. 2021;47:103192. doi:10.1016/j.ijoa.2021.103192. PMID 34144351.",
    url: "https://pubmed.ncbi.nlm.nih.gov/34144351/",
    supports: ["obstetric-evidence"],
    limitation:
      "CFF amplitude by 10 min (A10) ≤17 mm studied against Clauss fibrinogen ≤2 g/L; NOT MA. Observational evidence, not a local obstetric treatment algorithm. No FFP threshold established, and no platelet transfusion threshold validated. No pregnancy numerical ranges or MA conversion configured here.",
  },
  {
    id: "rossaint-2023",
    citation:
      "Rossaint R, Afshari A, Bouillon B, et al. The European guideline on management of major bleeding and coagulopathy following trauma: sixth edition. Crit Care. 2023;27:80.",
    url: "https://ccforum.biomedcentral.com/articles/10.1186/s13054-023-04327-7",
    supports: ["rule-ffp", "rule-cryo", "rule-platelets", "rule-txa", "escalation"],
    limitation:
      "Management of bleeding trauma, not validation of this numeric TEG6s ladder. Recommendation 23: TXA promptly for bleeding or risk of significant bleeding within 3 h of injury; do not await viscoelastic assessment.",
  },
  {
    id: "protamine-smpc",
    citation:
      "Wockhardt UK Ltd. Prosulf 10 mg/ml Solution for Injection (protamine sulfate), Summary of Product Characteristics, sections 4.2 and 4.4.",
    url: "https://www.medicines.org.uk/emc/product/8/smpc",
    supports: ["rule-protamine"],
    limitation:
      "Dose depends on actual heparin amount, type and elapsed time, not delta R. Excess protamine is anticoagulant; serious administration reactions possible. LMWH anti-Xa activity may not be fully reversed; use product-specific/local guidance.",
  },
  {
    id: "who-2025",
    citation:
      "World Health Organization, FIGO, ICM. Consolidated guidelines for the prevention, diagnosis and treatment of postpartum haemorrhage. Geneva: WHO; 2025. Recommendation 27. ISBN 9789240115637. Publication: https://www.who.int/publications/i/item/9789240115637/",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK619233/",
    supports: ["rule-txa-pregnancy", "obstetric-evidence"],
    limitation:
      "Confirmed PPH: initiate TXA within 3 hours of birth, not time of diagnosis. Pregnancy alone is not PPH; LY30 does not determine eligibility. No numeric dose computed by this app.",
  },
];
export function referencesFor(ruleId: string) {
  return REFERENCES.filter((r) => r.supports.includes(ruleId));
}

export const REFERENCE_RULES = [
  { id: "channel-definitions", label: "Original cartridge scope" },
  { id: "ranges-adult", label: "Manufacturer reference intervals — not treatment cutoffs" },
  {
    id: "obstetric-evidence",
    label: "Obstetric A10 evidence — NOT MA; no configured obstetric algorithm",
  },
  { id: "rule-ffp", label: "Prolonged reaction time — clinical/lab assessment" },
  { id: "rule-protamine", label: "Suspected heparin — exposure, contamination and SmPC" },
  { id: "rule-cryo", label: "Reduced functional fibrin contribution" },
  { id: "rule-platelets", label: "Reduced clot strength — combined deficits possible" },
  { id: "rule-txa", label: "Trauma TXA — within 3 hours of injury, not LY30 gated" },
  { id: "rule-txa-pregnancy", label: "PPH TXA — within 3 hours of birth, not pregnancy alone" },
];
export function searchReferences(query: string) {
  const q = query.trim().toLowerCase();
  const matches = (r: Reference) =>
    [r.citation, r.id, r.url, r.limitation, ...r.supports].some((s) => s.toLowerCase().includes(q));
  const rules = REFERENCE_RULES.map((rule) => ({
    ...rule,
    references: referencesFor(rule.id).filter(
      (r) => !q || [rule.label, rule.id].some((s) => s.toLowerCase().includes(q)) || matches(r),
    ),
  })).filter((rule) => rule.references.length > 0);
  const ids = new Set(rules.flatMap((rule) => rule.references.map((r) => r.id)));
  return { rules, bibliography: REFERENCES.filter((r) => !q || matches(r) || ids.has(r.id)) };
}
