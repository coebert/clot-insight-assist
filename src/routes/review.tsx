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

  const submit = () => {
    saveValues(values);
    navigate({ to: "/results" });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <Link to="/capture" className="text-sm text-muted-foreground underline">
          ← Back to capture
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Confirm values</h1>
        <DisclaimerBanner compact />

        <p className="text-sm text-muted-foreground">
          Check every value against the TEG 6s display. Edit any that are wrong
          or missing. Leave a field blank if the parameter is unavailable.
        </p>

        <div className="space-y-4">
          {(Object.keys(PARAM_META) as (keyof TegValues)[]).map((k) => {
            const meta = PARAM_META[k];
            return (
              <div key={k} className="rounded-lg border bg-card p-4">
                <label className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta.description}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Normal: {meta.normal} {meta.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
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
              </div>
            );
          })}
        </div>

        <button
          onClick={submit}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Generate recommendation
        </button>
      </div>
    </main>
  );
}
