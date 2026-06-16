import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractTegValues } from "@/lib/teg-extract.functions";
import { saveValues, EMPTY_VALUES } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Capture TEG 6s — Blood Product Advisor" },
      {
        name: "description",
        content:
          "Take a photo of the TEG 6s display or enter the parameters manually.",
      },
    ],
  }),
  component: Capture,
});

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function Capture() {
  const navigate = useNavigate();
  const extract = useServerFn(extractTegValues);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setStatus("loading");
    try {
      const dataUrl = await readAsDataUrl(file);
      setPreview(dataUrl);
      const result = await extract({ data: { imageDataUrl: dataUrl } });
      saveValues({
        CK_R: result.CK_R,
        CKH_R: result.CKH_R,
        CRT_MA: result.CRT_MA,
        CFF_MA: result.CFF_MA,
        CK_LY30: result.CK_LY30,
      });
      navigate({ to: "/review" });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  function manualEntry() {
    saveValues(EMPTY_VALUES);
    navigate({ to: "/review" });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <Link to="/" className="text-sm text-muted-foreground underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Capture results</h1>
        <DisclaimerBanner compact />

        <section className="rounded-lg border bg-card p-5 text-card-foreground">
          <h2 className="font-semibold">Photograph the TEG 6s screen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Frame the results panel showing CK, CKH, CRT, and CFF channels.
            You'll review every extracted value before any recommendation is shown.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={status === "loading"}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {status === "loading" ? "Reading image…" : "Take / choose photo"}
          </button>

          {preview && (
            <img
              src={preview}
              alt="Captured TEG display"
              className="mt-4 max-h-64 w-full rounded-md object-contain"
            />
          )}

          {error && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        <div className="text-center text-sm text-muted-foreground">or</div>

        <button
          onClick={manualEntry}
          className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Enter values manually
        </button>
      </div>
    </main>
  );
}
