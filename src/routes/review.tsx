import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  clearValues,
  savePopulation,
  saveValues,
  useTegSession,
} from "@/lib/teg-store";
import {
  getParamMeta,
  PLAUSIBLE,
  validateAll,
  type Population,
  type TegValues,
  type ValueIssue,
} from "@/lib/teg-algorithm";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

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
  const { values, population, hasValues } = useTegSession();

  useEffect(() => {
    // Route guard: if the user landed here directly without going through
    // /capture (or after a session reset), send them back rather than
    // rendering a form full of empty fields with no context.
    if (!hasValues) navigate({ to: "/capture", replace: true });
  }, [hasValues, navigate]);

  const meta = useMemo(() => getParamMeta(population), [population]);

  const update = (k: keyof TegValues, raw: string) => {
    const parsed = raw.trim() === "" ? null : Number(raw);
    const next = Number.isNaN(parsed as number) ? null : parsed;
    saveValues({ ...values, [k]: next });
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
    navigate({ to: "/results" });
  };

  const togglePregnant = (checked: boolean) => {
    const next: Population = checked ? "pregnant" : "standard";
    savePopulation(next);
  };

  const startOver = () => {
    if (!window.confirm("Discard the current values and return to capture?")) return;
    clearValues();
    navigate({ to: "/capture", replace: true });
  };

  if (!hasValues) return null;

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
          <Checkbox
            checked={population === "pregnant"}
            onCheckedChange={(c) => togglePregnant(c === true)}
            className="mt-0.5"
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
          <Alert
            variant={errorCount > 0 ? "destructive" : "default"}
            className={
              errorCount > 0
                ? undefined
                : "border-warning/40 bg-warning/10 text-warning [&>svg]:text-warning"
            }
          >
            <AlertTriangle className="h-4 w-4" />
            {errorCount > 0 && (
              <AlertTitle>
                {errorCount} value{errorCount === 1 ? "" : "s"} likely incorrect — fix before continuing.
              </AlertTitle>
            )}
            {warningCount > 0 && (
              <AlertDescription>
                {warningCount} value{warningCount === 1 ? "" : "s"} flagged for review.
              </AlertDescription>
            )}
          </Alert>
        )}

        <div className="space-y-4">
          {(Object.keys(meta) as (keyof TegValues)[]).map((k) => {
            const m = meta[k];
            const issue = issueByKey.get(k);
            const ring =
              issue?.severity === "error"
                ? "border-destructive ring-1 ring-destructive/40"
                : issue?.severity === "warning"
                  ? "border-warning ring-1 ring-warning/40"
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
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={0}
                      max={m.plausible[1]}
                      value={values[k] ?? ""}
                      onChange={(e) => update(k, e.target.value)}
                      className="w-24 text-right"
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
                      issue.severity === "error" ? "text-destructive" : "text-warning"
                    }`}
                  >
                    ⚠ {issue.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={submit} disabled={errorCount > 0} className="w-full">
            {errorCount > 0
              ? "Fix flagged values to continue"
              : warningCount > 0
                ? "Generate recommendation (review warnings first)"
                : "Generate recommendation"}
          </Button>
          <Button variant="outline" onClick={startOver} className="w-full">
            Discard and start over
          </Button>
        </div>
      </div>
    </main>
  );
}
