// Validated reference list for the algorithms and reference ranges used.
// Every clinical rule in src/lib/teg-algorithm.ts links back to one or more
// of these sources. DOIs/PMIDs are provided so each citation can be
// independently verified.

export type Reference = {
  id: string;
  citation: string;
  url: string; // canonical DOI / journal / publisher URL
  supports: string[]; // ids matching rule/range identifiers
};

export const REFERENCES: Reference[] = [
  {
    id: "haemonetics-manual",
    citation:
      "Haemonetics Corporation. TEG 6s Hemostasis Analyzer System — Operator's Manual (Global Hemostasis cartridge: CK, CKH, CRT, CFF). Haemonetics, Braintree MA.",
    url: "https://www.haemonetics.com/products/devices/diagnostic-devices/teg-6s-system",
    supports: ["ranges-adult", "channel-definitions"],
  },
  {
    id: "gillissen-2019",
    citation:
      "Gillissen A, van den Akker T, Caram-Deelder C, et al. Comparison of thromboelastometry by ROTEM® Delta and ROTEM® Sigma in women with postpartum haemorrhage. Scand J Clin Lab Invest. 2019;79(1-2):32-38.",
    url: "https://doi.org/10.1080/00365513.2019.1571220",
    supports: ["ranges-pregnancy", "fib-target-pph"],
  },
  {
    id: "delange-2014",
    citation:
      "de Lange NM, van Rheenen-Flach LE, Lancé MD, et al. Peri-partum reference ranges for ROTEM® thromboelastometry. Br J Anaesth. 2014;112(5):852-9.",
    url: "https://doi.org/10.1093/bja/aet480",
    supports: ["ranges-pregnancy"],
  },
  {
    id: "erdoes-2018",
    citation:
      "Erdoes G, Schloer H, Eberle B, Nagler M. Next generation viscoelasticity assays in cardiothoracic surgery: feasibility of the TEG6s system. PLoS One. 2018;13(12):e0209360.",
    url: "https://doi.org/10.1371/journal.pone.0209360",
    supports: ["ranges-adult", "channel-definitions"],
  },
  {
    id: "rossaint-2023",
    citation:
      "Rossaint R, Afshari A, Bouillon B, et al. The European guideline on management of major bleeding and coagulopathy following trauma: sixth edition. Crit Care. 2023;27(1):80.",
    url: "https://doi.org/10.1186/s13054-023-04327-7",
    supports: ["rule-ffp", "rule-cryo", "rule-platelets", "rule-txa"],
  },
  {
    id: "kozek-eshrm-2017",
    citation:
      "Kozek-Langenecker SA, Ahmed AB, Afshari A, et al. Management of severe perioperative bleeding: guidelines from the European Society of Anaesthesiology — first update 2016. Eur J Anaesthesiol. 2017;34(6):332-395.",
    url: "https://doi.org/10.1097/EJA.0000000000000630",
    supports: ["rule-ffp", "rule-cryo", "rule-platelets", "fib-target-pph"],
  },
  {
    id: "asa-2015",
    citation:
      "American Society of Anesthesiologists Task Force on Perioperative Blood Management. Practice guidelines for perioperative blood management: an updated report. Anesthesiology. 2015;122(2):241-275.",
    url: "https://doi.org/10.1097/ALN.0000000000000463",
    supports: ["rule-ffp", "rule-platelets", "rule-cryo"],
  },
  {
    id: "crash2-2010",
    citation:
      "CRASH-2 trial collaborators; Shakur H, Roberts I, Bautista R, et al. Effects of tranexamic acid on death, vascular occlusive events, and blood transfusion in trauma patients with significant haemorrhage (CRASH-2): a randomised, placebo-controlled trial. Lancet. 2010;376(9734):23-32.",
    url: "https://doi.org/10.1016/S0140-6736(10)60835-5",
    supports: ["rule-txa"],
  },
  {
    id: "woman-2017",
    citation:
      "WOMAN Trial Collaborators. Effect of early tranexamic acid administration on mortality, hysterectomy, and other morbidities in women with post-partum haemorrhage (WOMAN): an international, randomised, double-blind, placebo-controlled trial. Lancet. 2017;389(10084):2105-2116.",
    url: "https://doi.org/10.1016/S0140-6736(17)30638-4",
    supports: ["rule-txa", "rule-txa-pregnancy"],
  },
  {
    id: "rcog-gt52-2016",
    citation:
      "Mavrides E, Allard S, Chandraharan E, et al; on behalf of the Royal College of Obstetricians and Gynaecologists. Prevention and management of postpartum haemorrhage. RCOG Green-top Guideline No. 52. BJOG. 2016;124:e106-e149.",
    url: "https://doi.org/10.1111/1471-0528.14178",
    supports: ["fib-target-pph", "rule-cryo", "rule-txa-pregnancy"],
  },
  {
    id: "collins-2014",
    citation:
      "Collins PW, Lilley G, Bruynseels D, et al. Fibrin-based clot formation as an early and rapid biomarker for progression of postpartum haemorrhage: a prospective study. Blood. 2014;124(11):1727-36.",
    url: "https://doi.org/10.1182/blood-2014-04-567891",
    supports: ["fib-target-pph", "ranges-pregnancy"],
  },
  {
    id: "wikkelso-2017",
    citation:
      "Wikkelsø A, Wetterslev J, Møller AM, Afshari A. Thromboelastography (TEG) or thromboelastometry (ROTEM) to monitor haemostatic treatment versus usual care in adults or children with bleeding. Cochrane Database Syst Rev. 2017;(8):CD007871.",
    url: "https://doi.org/10.1002/14651858.CD007871.pub3",
    supports: ["evidence-base"],
  },
  {
    id: "scarlatescu-2019",
    citation:
      "Scarlatescu E, Juffermans NP, Thachil J. The current status of viscoelastic testing in septic coagulopathy. Thromb Res. 2019;183:146-152.",
    url: "https://doi.org/10.1016/j.thromres.2019.09.029",
    supports: ["evidence-base"],
  },
];

// Map each algorithmic decision to the supporting reference ids so the UI
// can render per-rule citations.
export const RULE_REFERENCES: Record<string, string[]> = {
  "rule-ffp": ["rossaint-2023", "kozek-eshrm-2017", "asa-2015"],
  "rule-protamine": ["haemonetics-manual", "kozek-eshrm-2017"],
  "rule-cryo": [
    "rossaint-2023",
    "kozek-eshrm-2017",
    "asa-2015",
    "collins-2014",
    "rcog-gt52-2016",
  ],
  "rule-platelets": ["rossaint-2023", "kozek-eshrm-2017", "asa-2015"],
  "rule-txa": ["crash2-2010", "rossaint-2023"],
  "rule-txa-pregnancy": ["woman-2017", "rcog-gt52-2016"],
  "ranges-adult": ["haemonetics-manual", "erdoes-2018"],
  "ranges-pregnancy": ["delange-2014", "gillissen-2019", "collins-2014"],
  "fib-target-pph": ["collins-2014", "rcog-gt52-2016", "gillissen-2019"],
  "channel-definitions": ["haemonetics-manual", "erdoes-2018"],
  "evidence-base": ["wikkelso-2017", "scarlatescu-2019"],
};

export function referencesFor(ruleId: string): Reference[] {
  const ids = RULE_REFERENCES[ruleId] ?? [];
  return ids
    .map((id) => REFERENCES.find((r) => r.id === id))
    .filter((r): r is Reference => Boolean(r));
}
