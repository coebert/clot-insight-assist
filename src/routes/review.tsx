import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  hasSavedValues,
  loadPopulation,
  loadValues,
  savePopulation,
  saveValues,
  EMPTY_VALUES,
} from "@/lib/teg-store";
import {
  getParamMeta,
  validateAll,
  type Population,
  type TegValues,
  type ValueIssue,
} from "@/lib/teg-algorithm";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review values — TEG 6s Advisor" },
      {
        name: "description",
        content:
          "Review and confirm the TEG 6s parameters before generating a recommendation.",
      },
    ],
  }),
  component: Review,
});

function Review() {
  const navigate = useNavigate();
  const [values, setValues] = useState<TegValues>(EMPTY_VALUES);
  const [population, setPopulation] = useState<Population>("standard");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Route guard: if the user landed here directly without going through
    // /capture (or after a session reset), send them back rather than
    // rendering a form full of empty fields with no context.
    if (!hasSavedValues()) {
      navigate({ to: "/capture", replace: true });
      return;
    }
    setValues(loadValues());
    setPopulation(loadPopulation());
    setReady(true);
  }, [navigate]);

  const meta = useMemo(() => getParamMeta(population), [population]);


  const update = (k: keyof TegValues, raw: string) => {
    const next = raw.trim() === "" ? null : Number(raw);
    setValues((v) => ({ ...v, [k]: Number.isNaN(next as number) ? null : next }));
  };

  const issues = useMemo(() => validateAll(values), [values]);
  const issueByKey = useMemo(() => {
    const m = new Map<keyof TegValues, ValueIssue>();
    for (const i of issues) {
      const existing = m.get(i.key);
      if (!existing || (existing.severity === "warning" && i.severity === "error")) {
        m.set(i.key, i);
      }
    }
    return m;
  }, [issues]);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const submit = () => {
    if (errorCount > 0) return;
    saveValues(values);
    savePopulation(population);
    navigate({ to: "/results" });
  };

  const togglePregnant = (checked: boolean) => {
    const next: Population = checked ? "pregnant" : "standard";
    setPopulation(next);
    savePopulation(next);
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/capture" className="text-sm text-muted-foreground underline">
            ← Back to capture
          </Link>
          <Logo size={28} withWordmark />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Confirm values</h1>
        <DisclaimerBanner compact />

        <p className="text-sm text-muted-foreground">
          Check every value against the TEG 6s display. Edit any that are wrong
          or missing. Leave a field blank if the parameter is unavailable.
        </p>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            population === "pregnant"
              ? "border-primary/60 bg-primary/10"
              : "border-border bg-card"
          }`}
        >
          <input
            type="checkbox"
            checked={population === "pregnant"}
            onChange={(e) => togglePregnant(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[color:var(--primary)]"
          />
          <div className="text-sm">
            <div className="font-semibold text-foreground">
              Patient is pregnant
            </div>
            <div className="text-xs text-muted-foreground">
              Apply third-trimester / peripartum reference ranges and
              transfusion thresholds (fibrinogen target raised, LY30 cutoff
              tightened).
            </div>
          </div>
        </label>

        {(errorCount > 0 || warningCount > 0) && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              errorCount > 0
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning/10 text-warning"
            }`}
          >
            {errorCount > 0 && (
              <p className="font-semibold">
                {errorCount} value{errorCount === 1 ? "" : "s"} likely incorrect — fix before continuing.
              </p>
            )}
            {warningCount > 0 && (
              <p className={errorCount > 0 ? "mt-1 text-xs" : "text-xs"}>
                {warningCount} value{warningCount === 1 ? "" : "s"} flagged for review.
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {(Object.keys(meta) as (keyof TegValues)[]).map((k) => {
            const m = meta[k];
            const issue = issueByKey.get(k);
            const ring =
              issue?.severity === "error"
                ? "border-destructive ring-1 ring-destructive/40"
                : issue?.severity === "warning"
                  ? "border-amber-400 ring-1 ring-amber-300/40"
                  : "";
            return (
              <div key={k} className={`rounded-lg border bg-card p-4 ${ring}`}>
                <label className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.description}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Normal{population === "pregnant" ? " (pregnancy)" : ""}: {m.normal} {m.unit} · Plausible: {m.plausible[0]}–{m.plausible[1]} {m.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={0}
                      max={m.plausible[1]}
                      value={values[k] ?? ""}
                      onChange={(e) => update(k, e.target.value)}
                      className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm"
                      placeholder="—"
                    />
                    <span className="w-8 text-xs text-muted-foreground">
                      {m.unit}
                    </span>
                  </div>
                </label>
                {issue && (
                  <p
                    className={`mt-2 text-xs ${
                      issue.severity === "error" ? "text-destructive" : "text-amber-300"
                    }`}
                  >
                    {issue.severity === "error" ? "⚠ " : "⚠ "}
                    {issue.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={submit}
          disabled={errorCount > 0}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {errorCount > 0
            ? "Fix flagged values to continue"
            : warningCount > 0
              ? "Generate recommendation (review warnings first)"
              : "Generate recommendation"}
        </button>
      </div>
    </main>
  );
}
