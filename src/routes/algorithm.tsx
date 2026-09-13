import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Mermaid } from "@/components/Mermaid";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { CITATION } from "@/lib/teg-algorithm";
import { REFERENCES, referencesFor, type Reference } from "@/lib/teg-references";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Small local hook — avoids re-filtering the reference library on every
// keystroke while the user is still typing.
function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Renders one reference list item — used by both the per-rule cards and the
// full bibliography, so citation formatting stays consistent.
function ReferenceItem({ r }: { r: Reference }) {
  return (
    <li id={`ref-${r.id}`}>
      <span>{r.citation}</span>{" "}
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        Source ↗
      </a>
    </li>
  );
}


const RULES_IN_ORDER: { id: string; label: string }[] = [
  { id: "channel-definitions", label: "TEG 6s channels & parameter definitions" },
  { id: "ranges-adult", label: "Adult reference ranges" },
  { id: "ranges-pregnancy", label: "Pregnancy (peripartum) reference ranges" },
  { id: "rule-ffp", label: "Rule: Prolonged CK.R → FFP" },
  { id: "rule-protamine", label: "Rule: CK.R − CKH.R > 2 min → Protamine" },
  { id: "rule-cryo", label: "Rule: Low CFF.MA → Cryoprecipitate / fibrinogen concentrate" },
  { id: "fib-target-pph", label: "Pregnancy: fibrinogen target ≥ 2 g/L (CFF.MA ≈ 20 mm)" },
  { id: "rule-platelets", label: "Rule: Low CRT.MA with adequate fibrinogen → Platelets" },
  { id: "rule-txa", label: "Rule: CK.LY30 > threshold → Tranexamic acid (adult)" },
  { id: "rule-txa-pregnancy", label: "Rule: Tranexamic acid in postpartum haemorrhage" },
  { id: "evidence-base", label: "Overall evidence base for viscoelastic-guided transfusion" },
];

export const Route = createFileRoute("/algorithm")({
  head: () => ({
    meta: [
      { title: "Algorithm — Clot Clarity" },
      {
        name: "description",
        content:
          "Decision trees and reference ranges used by Clot Clarity to interpret TEG 6s results.",
      },
    ],
  }),
  component: AlgorithmPage,
});

const MAIN_FLOW = `flowchart TD
  Start([TEG 6s values entered])
  Start --> R1{CK.R > R_max?}
  R1 -- No --> R2
  R1 -- Yes --> Hep{CK.R − CKH.R > 2 min?}
  Hep -- Yes --> Prot["<b>Protamine</b><br/>Residual heparin<br/>(per local protocol)"]
  Hep -- No --> FFP["<b>FFP</b> 10–15 mL/kg<br/>Factor deficiency"]
  Prot --> Resid{CKH.R still > R_max?}
  Resid -- Yes --> FFP
  Resid -- No --> R2
  FFP --> R2

  R2{CFF.MA < Fib_low?}
  R2 -- Yes --> Cryo["<b>Cryoprecipitate</b><br/>or fibrinogen concentrate<br/>(cryo 1 u / 10 kg, or<br/>fib conc 25–50 mg/kg)"]
  R2 -- No --> R3
  Cryo --> R3

  R3{CRT.MA < Plt_low<br/>AND CFF.MA ≥ Fib_low?}
  R3 -- Yes --> Plt["<b>Platelets</b><br/>1 adult dose"]
  R3 -- No --> R4
  Plt --> R4

  R4{CK.LY30 > LY_high?}
  R4 -- Yes --> TXA["<b>Tranexamic acid</b><br/>1 g IV"]
  R4 -- No --> Done
  TXA --> Done

  Done([Display recommendation])

  classDef action fill:#3a1418,stroke:#dc2638,stroke-width:2px,color:#fff;
  classDef decision fill:#1f2230,stroke:#6b7280,color:#fafafa;
  classDef start fill:#0f1115,stroke:#dc2638,color:#fafafa;
  class Prot,FFP,Cryo,Plt,TXA action;
  class R1,Hep,Resid,R2,R3,R4 decision;
  class Start,Done start;
`;

const THRESHOLDS = `flowchart LR
  subgraph STD[Standard adult]
    direction TB
    S1["R_max = 10 min"]
    S2["Fib_low = 15 mm"]
    S3["Plt_low = 52 mm"]
    S4["LY_high = 3 %"]
  end
  subgraph PRG[Pregnant — 3rd trimester]
    direction TB
    P1["R_max = 9 min"]
    P2["Fib_low = 20 mm<br/>(target ≥ 2 g/L)"]
    P3["Plt_low = 55 mm"]
    P4["LY_high = 2.6 %"]
  end
  STD --- PRG

  classDef std fill:#1f2230,stroke:#6b7280,color:#fafafa;
  classDef prg fill:#3a1418,stroke:#dc2638,color:#fafafa;
  class S1,S2,S3,S4 std;
  class P1,P2,P3,P4 prg;
`;

const RANGES = `flowchart TB
  T["TEG 6s reference ranges<br/>(Global Hemostasis cartridge)"]
  T --> CK["<b>CK.R</b> — factor activity<br/>Adult: 4.6 – 9.1 min<br/>Pregnancy: 4.6 – 8.7 min"]
  T --> CKH["<b>CKH.R</b> — heparinase channel<br/>Compared to CK.R<br/>Δ > 2 min ⇒ heparin effect"]
  T --> CRT["<b>CRT.MA</b> — clot strength<br/>Adult: 52 – 70 mm<br/>Pregnancy: 60 – 73 mm"]
  T --> CFF["<b>CFF.MA</b> — fibrinogen<br/>Adult: 15 – 32 mm<br/>Pregnancy: 18 – 41 mm"]
  T --> LY["<b>CK.LY30</b> — fibrinolysis<br/>Adult: < 3 %<br/>Pregnancy: < 2.6 %"]

  classDef hub fill:#3a1418,stroke:#dc2638,color:#fff;
  classDef leaf fill:#1f2230,stroke:#6b7280,color:#fafafa;
  class T hub;
  class CK,CKH,CRT,CFF,LY leaf;
`;

function matchesQuery(r: Reference, query: string): boolean {
  const q = query.toLowerCase();
  return (
    r.citation.toLowerCase().includes(q) ||
    r.id.toLowerCase().includes(q) ||
    r.supports.some((s) => s.toLowerCase().includes(q)) ||
    r.url.toLowerCase().includes(q)
  );
}

function AlgorithmPage() {
  const [query, setQuery] = useState("");
  // Debounce the *filter* input, not the visible text — the input still feels
  // responsive but heavy reference-list filtering only runs after the user
  // pauses typing.
  const debounced = useDebouncedValue(query, 150);
  const q = debounced.trim().toLowerCase();

  const filteredRules = useMemo(() => {
    if (!q) return RULES_IN_ORDER;
    return RULES_IN_ORDER.filter(({ id, label }) => {
      if (label.toLowerCase().includes(q) || id.toLowerCase().includes(q))
        return true;
      const refs = referencesFor(id);
      return refs.some((r) => matchesQuery(r, q));
    });
  }, [q]);

  const filteredBibliography = useMemo(() => {
    if (!q) return REFERENCES;
    return REFERENCES.filter((r) => matchesQuery(r, q));
  }, [q]);


  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground underline">
            ← Home
          </Link>
          <Logo size={28} withWordmark />
        </div>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Transparency
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            How recommendations are made
          </h1>
          <p className="text-muted-foreground">
            Clot Clarity uses a transparent, rule-based decision tree — no AI in
            the decision path. The vision model only reads numbers from the
            screen; every threshold below is fixed and auditable.
          </p>
        </header>

        <DisclaimerBanner />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Decision tree</h2>
          <p className="text-sm text-muted-foreground">
            Each entered value is checked in order. Multiple recommendations can
            fire from a single result set (e.g. FFP + cryoprecipitate).
          </p>
          <Mermaid chart={MAIN_FLOW} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Thresholds: adult vs pregnancy</h2>
          <p className="text-sm text-muted-foreground">
            Ticking the "patient is pregnant" box on the review screen swaps the
            thresholds used in the tree above.
          </p>
          <Mermaid chart={THRESHOLDS} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Reference ranges</h2>
          <Mermaid chart={RANGES} />
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">References</h2>
            <p className="text-sm text-muted-foreground">
              Every rule and reference range maps to one or more peer-reviewed
              sources or manufacturer documents listed below. Each DOI link
              resolves to the canonical published version for independent
              verification.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by keyword, author, rule, or topic..."
              className="h-10 pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {q && (
            <p className="text-xs text-muted-foreground">
              {filteredRules.length} rule{filteredRules.length === 1 ? "" : "s"} and{" "}
              {filteredBibliography.length} source{filteredBibliography.length === 1 ? "" : "s"} match.
            </p>
          )}

          <div className="space-y-3">
            {filteredRules.map(({ id, label }) => {
              const refs = referencesFor(id).filter((r) =>
                q ? matchesQuery(r, q) : true,
              );
              if (refs.length === 0) return null;
              return (
                <div
                  key={id}
                  className="rounded-lg border border-border bg-card/60 p-4"
                >
                  <h3 className="text-sm font-semibold text-foreground">
                    {label}
                  </h3>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs text-muted-foreground marker:text-primary">
                    {refs.map((r) => (
                      <ReferenceItem key={r.id} r={r} />
                    ))}
                  </ol>
                </div>
              );
            })}
            {q && filteredRules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No rules match your search.
              </p>
            )}
          </div>

          <details className="rounded-lg border border-border bg-card/40 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Full bibliography ({filteredBibliography.length} source
              {filteredBibliography.length === 1 ? "" : "s"})
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-muted-foreground marker:text-primary">
              {filteredBibliography.map((r) => (
                <ReferenceItem key={r.id} r={r} />
              ))}
            </ol>
            {q && filteredBibliography.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No sources match your search.
              </p>
            )}
          </details>

          <p className="text-xs text-muted-foreground">{CITATION}</p>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full">
            <Link to="/capture">Start a new analysis</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Home</Link>
          </Button>
        </div>

      </div>
    </main>
  );
}
