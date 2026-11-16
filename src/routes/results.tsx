import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  CITATION,
  getParamMeta,
  interpret,
  type TegValues,
} from "@/lib/teg-algorithm";
import { clearValues, hasSavedValues, isCaseVerified, useTegSession } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Recommendation — TEG 6s Advisor" },
      { property: "og:description", content: "Verified TEG 6s findings with clinical safeguards and unavailable assessments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Recommendation — TEG 6s Advisor" },
      {
        name: "description",
        content:
          "Blood product recommendations derived from the entered TEG 6s parameters.",
      },
    ],
  }),
  component: Results,
});

function Results() {
  const navigate = useNavigate();
  const { values, population, hasValues, context, verified } = useTegSession();

  useEffect(() => {
    // Route guard — a blank recommendation is worse than sending the user back.
    // Read hasSavedValues() directly: effects run client-side only, and this
    // avoids the hydration commit where useSyncExternalStore still reports
    // the (empty) server snapshot — which would bounce a reloaded page back
    // to /capture despite values being saved.
    if (!hasSavedValues()) navigate({ to: "/capture", replace: true });
    else if (!isCaseVerified()) navigate({ to: "/review", replace: true });
  }, [hasValues, verified, navigate]);

  const meta = useMemo(() => getParamMeta(population), [population]);
  const { recommendations, missing, abnormal, unavailable, guidance, errors } = useMemo(
    () => interpret(values, context),
    [values, context],
  );


  const startOver = () => {
    // Explicit confirm — the recommendation is transient and can't be recovered
    // once cleared. Losing it accidentally on a mis-tap would be a real
    // clinical annoyance mid-case.
    const ok =
      typeof window === "undefined" ||
      window.confirm("Clear the current TEG values and start a new case?");
    if (!ok) return;
    clearValues();
    navigate({ to: "/" });
  };

  if (!hasValues || !verified || errors.length) return null;

  return (
    <main className="min-h-screen px-4 py-8 print:py-2">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/review" className="text-sm text-muted-foreground underline">
            ← Edit values
          </Link>
          <Logo size={28} withWordmark />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Interpretation</h1>
        <DisclaimerBanner compact />

        {population === "pregnant" && (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <strong>Obstetric context:</strong> no validated local obstetric algorithm configured. No automated product or dose decisions.
          </div>
        )}

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Entered values</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {(Object.keys(meta) as (keyof TegValues)[]).map((k) => (
              <div key={k} className="flex justify-between gap-2 border-b border-border/50 py-1">
                <dt className="text-muted-foreground">{meta[k].label}</dt>
                <dd className="font-mono">
                  {values[k] === null ? "—" : `${values[k]} ${meta[k].unit}`}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {missing.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Missing values: {missing.map((k) => meta[k].label).join(", ")}.
            These are unavailable assessments, not reassuring findings.
          </div>
        )}

        <section className="space-y-3" aria-label="Clinical safeguards">
          {guidance.map(text => <p key={text} className="text-sm text-warning">{text}</p>)}
          {unavailable.map(text => <p key={text} className="text-sm text-muted-foreground">{text}</p>)}
          {abnormal.length > 0 && <div><h2 className="font-semibold">Outside manufacturer reference intervals{population === 'pregnant' ? ' (non-obstetric comparison only)' : ''}</h2><ul className="mt-2 space-y-1 text-sm">{abnormal.map(a => <li key={a.key}>{meta[a.key].label}: {a.value} {meta[a.key].unit} — {a.direction}; not a diagnosis or treatment indication</li>)}</ul></div>}
        </section>
        <section className="space-y-3">
          {recommendations.map((r) => (
            <article
              key={r.id}
              className={`rounded-lg border p-4 ${
                r.severity === "action"
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <header className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{r.product}</h3>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {r.severity === "action" ? "Consider" : "Info"}
                </span>
              </header>
              <p className="mt-1 text-sm font-medium">{r.finding}</p>
              <p className="mt-1 text-xs text-muted-foreground">Illustrative trigger: {r.trigger}</p>
              {r.dose !== "—" && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Suggested dose: </span>
                  {r.dose}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{r.rationale}</p>
            </article>
          ))}
        </section>

        <p className="text-center text-xs text-muted-foreground print:hidden">
          <Link to="/algorithm" className="underline underline-offset-4 hover:text-foreground">
            View the decision tree this recommendation came from
          </Link>
          <span className="mx-2 opacity-50">·</span>
          <Link to="/rules" className="underline underline-offset-4 hover:text-foreground">
            Rules reference
          </Link>
        </p>

        <p className="text-xs text-muted-foreground">{CITATION}</p>

        <div className="flex flex-col gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="w-full">
            Print / Save as PDF
          </Button>
          <Button onClick={startOver} className="w-full">
            Start over
          </Button>
        </div>
      </div>
    </main>
  );
}
