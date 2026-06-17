import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadValues, saveValues, EMPTY_VALUES } from "@/lib/teg-store";
import {
  PARAM_META,
  validateAll,
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

  useEffect(() => {
    setValues(loadValues());
  }, []);

  const update = (k: keyof TegValues, raw: string) => {
    const next = raw.trim() === "" ? null : Number(raw);
    setValues((v) => ({ ...v, [k]: Number.isNaN(next as number) ? null : next }));
  };

  const issues = useMemo(() => validateAll(values), [values]);
  const issueByKey = useMemo(() => {
    const m = new Map<keyof TegValues, ValueIssue>();
    // Errors win over warnings for the per-field highlight.
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
    navigate({ to: "/results" });
  };

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

        {(errorCount > 0 || warningCount > 0) && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              errorCount > 0
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-amber-500/40 bg-amber-500/10 text-amber-200"
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
          {(Object.keys(PARAM_META) as (keyof TegValues)[]).map((k) => {
            const meta = PARAM_META[k];
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
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta.description}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Normal: {meta.normal} {meta.unit} · Plausible: {meta.plausible[0]}–{meta.plausible[1]} {meta.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={0}
                      max={meta.plausible[1]}
                      value={values[k] ?? ""}
                      onChange={(e) => update(k, e.target.value)}
                      className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm"
                      placeholder="—"
                    />
                    <span className="w-8 text-xs text-muted-foreground">
                      {meta.unit}
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
