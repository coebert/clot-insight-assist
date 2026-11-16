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
      <span>{r.citation} {r.limitation}</span>{" "}
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


const RULES_IN_ORDER = [
  { id: 'channel-definitions', label: 'Original cartridge scope' },
  { id: 'ranges-adult', label: 'Manufacturer reference intervals — not treatment cutoffs' },
  { id: 'obstetric-evidence', label: 'Obstetric A10 evidence — NOT MA; no configured obstetric algorithm' },
  { id: 'rule-ffp', label: 'Prolonged reaction time — clinical/lab assessment' },
  { id: 'rule-protamine', label: 'Suspected heparin — exposure, contamination and SmPC' },
  { id: 'rule-cryo', label: 'Reduced functional fibrin contribution' },
  { id: 'rule-platelets', label: 'Reduced clot strength — combined deficits possible' },
  { id: 'rule-txa', label: 'Trauma TXA — within 3 hours of injury, not LY30 gated' },
  { id: 'rule-txa-pregnancy', label: 'PPH TXA — within 3 hours of birth, not pregnancy alone' },
];

export const Route = createFileRoute("/algorithm")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Algorithm — Clot Clarity" },
      { property: "og:description", content: "Clinical gates, illustrative findings, source limitations and decision diagrams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
 Start[Completed original TEG6s CK CKH CRT CFF values] --> Valid{Valid nonempty input?}
 Valid -- No --> Block[Block interpretation]
 Valid -- Yes --> Scope{Adult and compatible cartridge confirmed?}
 Scope -- No --> Block
 Scope -- Yes --> Verify{Exact values and context verified?}
 Verify -- No --> Review[Return to review]
 Verify -- Yes --> Context{Active significant bleeding and non-obstetric context and no warnings?}
 Context -- No --> Findings[Interpretive findings and lab correlation only - no product or dose decisions]
 Context -- Yes --> Ladder[Illustrative adult ladder - not universal validated treatment thresholds]
 Ladder --> R{CK.R greater than 10?}
 R -- Yes --> H{CKH.R available?}
 H -- No --> Missing[Heparin comparison and plasma branch unavailable]
 H -- Yes --> D{CK.R minus CKH.R greater than 2?}
 D -- Yes --> Hep[Suspected heparin - check exposure and contamination - no calculated protamine dose]
 D -- No --> Plasma[Consider plasma only with clinical and lab correlation]
 Hep --> Resid{CKH.R also greater than 10?}
 Resid -- Yes --> Plasma
 Ladder --> Fib{CFF.MA less than 15?}
 Fib -- Yes --> F[Reduced fibrin contribution - Clauss fibrinogen and local protocol]
 Ladder --> MA{CRT.MA less than 52?}
 MA -- Yes --> C{CFF.MA available and at least 15?}
 C -- Yes --> P[Platelet contribution assessment - counts and local protocol]
 C -- No --> Both[Missing fibrin assessment or combined deficits - reassess counts and MA after fibrin correction]
 Ladder --> LY{CK.LY30 greater than 3?}
 LY -- Yes --> Lysis[Increased observed lysis - not a universal TXA indication]
 Ladder --> Done[No trigger does not establish normal haemostasis or exclude bleeding]
 Start -. Immediate clinical escalation - do not wait for TEG .-> Emergency[Suspected major haemorrhage - activate local protocol]
`;
const THRESHOLDS = `flowchart TD
 T[Context-dependent TXA guidance - independent of LY30] --> Trauma[Bleeding trauma or risk of significant bleeding - assess promptly within 3 hours of injury]
 T --> PPH[Confirmed PPH - within 3 hours of birth - pregnancy alone is not PPH]
 Trauma --> Protocol[Do not await viscoelastic testing - indication-specific local protocol - no numeric dose calculated]
 PPH --> Protocol
 T --> Unknown[Absent or unknown bleeding or timing outside or unknown - no automatic TXA instruction]
`;
const RANGES = `flowchart TD
 T[Revision AB manufacturer intervals - not treatment triggers] --> CK[CK.R 4.6 to 9.1 min]
 T --> CKH[CKH.R 4.3 to 8.3 min]
 T --> CRT[CRT.MA 52 to 70 mm]
 T --> CFF[CFF.MA 13 to 30 mm]
 T --> LY[CK.LY30 0 to 2.6 percent]
 T --> OB[No validated local obstetric algorithm or pregnancy intervals configured]
 OB --> A10[Roberts 2021 CFF A10 at most 17 mm is NOT MA - not used as an MA cutoff]
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
            Clinical safeguards and finding diagrams
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
            Clinical gates precede findings. Product considerations require active bleeding in a non-obstetric adult context and local protocol/lab correlation. No numeric doses are calculated.
          </p>
          <Mermaid chart={MAIN_FLOW} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">TXA context and timing</h2>
          <p className="text-sm text-muted-foreground">
            TXA guidance does not depend on elevated LY30. No validated local obstetric algorithm is configured.
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
              Sources support the stated intervals or context-specific guidance; they do not validate the illustrative numeric ladder as a universal treatment algorithm. Limitations are listed with each source.
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
              <Button variant="ghost" size="icon"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
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
