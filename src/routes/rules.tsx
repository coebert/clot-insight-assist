import { createFileRoute, Link } from "@tanstack/react-router";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import {
  CITATION,
  PLAUSIBLE,
  THRESHOLDS,
  getParamMeta,
  type TegValues,
} from "@/lib/teg-algorithm";
import { referencesFor } from "@/lib/teg-references";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rules Reference — Clot Clarity" },
      {
        name: "description",
        content:
          "Every TEG 6s parameter, its adult and pregnancy reference range, plausible input bounds, and the full rule ladder used to recommend blood products.",
      },
      { property: "og:title", content: "Rules Reference — Clot Clarity" },
      {
        property: "og:description",
        content:
          "TEG 6s parameters, reference ranges, plausible bounds and the complete blood-product rule ladder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

const KEYS: (keyof TegValues)[] = [
  "CK_R",
  "CKH_R",
  "CRT_MA",
  "CFF_MA",
  "CK_LY30",
];

type RuleRow = {
  id: string;
  order: number;
  finding: string;
  conditionAdult: string;
  conditionPregnant: string;
  product: string;
  dose: string;
  rationale: string;
  refIds: string;
};

const A = THRESHOLDS.standard;
const P = THRESHOLDS.pregnant;

const RULES: RuleRow[] = [
  {
    id: "rule-ffp",
    order: 1,
    finding: "Prolonged CK.R — clotting factor deficiency",
    conditionAdult: `CK.R > ${A.R_prolonged} min, and either no heparin effect or CKH.R also > ${A.R_prolonged} min`,
    conditionPregnant: `CK.R > ${P.R_prolonged} min, and either no heparin effect or CKH.R also > ${P.R_prolonged} min`,
    product: "Fresh Frozen Plasma (FFP)",
    dose: "10–15 mL/kg",
    rationale:
      "A prolonged R on the kaolin channel reflects deficient clotting factors. Suppressed when heparin fully explains the prolongation.",
    refIds: "rule-ffp",
  },
  {
    id: "rule-protamine",
    order: 2,
    finding: "Residual heparin effect",
    conditionAdult: `CK.R > ${A.R_prolonged} min AND (CK.R − CKH.R) > ${A.heparin_delta} min`,
    conditionPregnant: `CK.R > ${P.R_prolonged} min AND (CK.R − CKH.R) > ${P.heparin_delta} min`,
    product: "Protamine sulfate",
    dose: "Per institutional protocol (typically 25–50 mg test dose)",
    rationale:
      "R corrects when heparinase is added, so the prolongation is circulating heparin rather than factor deficiency.",
    refIds: "rule-protamine",
  },
  {
    id: "rule-cryo",
    order: 3,
    finding: "Hypofibrinogenaemia",
    conditionAdult: `CFF.MA < ${A.fib_low} mm`,
    conditionPregnant: `CFF.MA < ${P.fib_low} mm`,
    product: "Cryoprecipitate or fibrinogen concentrate",
    dose: "Cryoprecipitate 1 unit / 10 kg, or fibrinogen concentrate 25–50 mg/kg",
    rationale:
      "Low Functional Fibrinogen MA indicates insufficient fibrinogen for clot formation.",
    refIds: "rule-cryo",
  },
  {
    id: "rule-platelets",
    order: 4,
    finding: "Reduced platelet contribution to clot strength",
    conditionAdult: `CRT.MA < ${A.platelet_low} mm AND CFF.MA ≥ ${A.fib_low} mm`,
    conditionPregnant: `CRT.MA < ${P.platelet_low} mm AND CFF.MA ≥ ${P.fib_low} mm`,
    product: "Platelets",
    dose: "1 adult therapeutic dose (≈1 apheresis unit or pool of 4–6)",
    rationale:
      "Low overall MA with adequate fibrinogen MA isolates the deficit to platelet number or function.",
    refIds: "rule-platelets",
  },
  {
    id: "rule-txa",
    order: 5,
    finding: "Hyperfibrinolysis",
    conditionAdult: `CK.LY30 > ${A.ly30_high}%`,
    conditionPregnant: `CK.LY30 > ${P.ly30_high}%`,
    product: "Tranexamic acid (antifibrinolytic)",
    dose: "1 g IV over 10 min, then 1 g over 8 h (CRASH-2); in PPH, 1 g IV, repeat after 30 min if bleeding continues (WOMAN)",
    rationale: "Elevated LY30 indicates accelerated clot breakdown.",
    refIds: "rule-txa",
  },
];

const SANITY_CHECKS = [
  {
    title: "Plausibility bounds",
    body: "Any value outside the bounds in the table above is treated as an error — most often an OCR misread or a unit mix-up. Recommendations are blocked until it is corrected.",
  },
  {
    title: "Heparinase cross-check",
    body: "CKH.R more than 2 min longer than CK.R raises a warning: adding heparinase should not prolong the reaction time.",
  },
  {
    title: "Fibrinogen vs clot strength",
    body: "CFF.MA greater than CRT.MA raises a warning — the fibrinogen contribution cannot exceed overall clot strength.",
  },
  {
    title: "Missing values",
    body: "Blank parameters are allowed but listed on the results screen; rules that depend on them simply do not fire.",
  },
];

function RulesPage() {
  const adultMeta = getParamMeta("standard");
  const pregMeta = getParamMeta("pregnant");

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground underline">
            ← Home
          </Link>
          <Logo size={28} withWordmark />
        </div>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Rules reference
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Parameters, ranges and the full rule ladder
          </h1>
          <p className="text-muted-foreground">
            Everything the engine uses, in one place: each TEG 6s parameter with
            its reference and plausible ranges, then every rule with its exact
            trigger condition, product and dose. For the same logic as a
            flowchart, see the{" "}
            <Link to="/algorithm" className="text-primary underline">
              decision diagrams
            </Link>
            .
          </p>
        </header>

        <DisclaimerBanner />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Parameters</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Parameter</th>
                  <th className="p-3">Meaning</th>
                  <th className="p-3">Adult range</th>
                  <th className="p-3">Pregnancy range</th>
                  <th className="p-3">Plausible input</th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map((k) => {
                  const m = adultMeta[k];
                  const [lo, hi] = PLAUSIBLE[k];
                  return (
                    <tr key={k} className="border-t border-border align-top">
                      <td className="p-3 font-semibold">
                        {m.label}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {m.unit}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {m.description}
                      </td>
                      <td className="p-3 tabular-nums">{m.normal}</td>
                      <td className="p-3 tabular-nums">{pregMeta[k].normal}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">
                        {lo} – {hi}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Rule ladder</h2>
          <p className="text-sm text-muted-foreground">
            Rules are evaluated independently and in this order; every rule that
            fires is shown on the results screen.
          </p>
          <div className="space-y-4">
            {RULES.map((r) => (
              <article
                key={r.id}
                id={r.id}
                className="space-y-3 rounded-lg border border-border bg-card/60 p-4"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-semibold text-primary">
                    Rule {r.order}
                  </span>
                  <h3 className="font-semibold">{r.finding}</h3>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Trigger (adult)
                    </dt>
                    <dd className="tabular-nums">{r.conditionAdult}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Trigger (pregnancy)
                    </dt>
                    <dd className="tabular-nums">{r.conditionPregnant}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Product
                    </dt>
                    <dd className="font-medium">{r.product}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Dose
                    </dt>
                    <dd>{r.dose}</dd>
                  </div>
                </dl>

                <p className="text-sm text-muted-foreground">{r.rationale}</p>

                <ul className="space-y-1 text-xs text-muted-foreground">
                  {referencesFor(r.refIds).map((ref) => (
                    <li key={ref.id}>
                      {ref.citation}{" "}
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-medium text-primary underline underline-offset-2"
                      >
                        Source ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            If no rule fires and no value is missing, the result is “no blood
            product indicated based on TEG”.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Validation and sanity checks</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SANITY_CHECKS.map((c) => (
              <div
                key={c.title}
                className="rounded-lg border border-border bg-card/60 p-4"
              >
                <h3 className="text-sm font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Sources</h2>
          <p className="text-sm text-muted-foreground">{CITATION}</p>
          <Link to="/algorithm" className="text-sm text-primary underline">
            Full bibliography and searchable references →
          </Link>
        </section>
      </div>
    </main>
  );
}
