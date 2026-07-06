import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  CITATION,
  getParamMeta,
  interpret,
  type TegValues,
} from "@/lib/teg-algorithm";
import { clearValues, useTegSession } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
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
  const { values, population, hasValues } = useTegSession();

  useEffect(() => {
    // Route guard — a blank recommendation is worse than sending the user back.
    if (!hasValues) navigate({ to: "/capture", replace: true });
  }, [hasValues, navigate]);

  const meta = useMemo(() => getParamMeta(population), [population]);
  const { recommendations, missing } = useMemo(
    () => interpret(values, population),
    [values, population],
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

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 print:py-2">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/review" className="text-sm text-muted-foreground underline">
            ← Edit values
          </Link>
          <Logo size={28} withWordmark />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Recommendation</h1>
        <DisclaimerBanner compact />

        {population === "pregnant" && (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <strong>Pregnancy-adjusted interpretation:</strong> third-trimester
            reference ranges and peripartum transfusion thresholds applied.
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
            Rules requiring these parameters were skipped.
          </div>
        )}

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
              <p className="mt-1 text-xs text-muted-foreground">Trigger: {r.trigger}</p>
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
        </p>

        <p className="text-xs text-muted-foreground">{CITATION}</p>

        <div className="flex flex-col gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Print / Save as PDF
          </button>
          <button
            onClick={startOver}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start over
          </button>
        </div>
      </div>
    </main>
  );
}
