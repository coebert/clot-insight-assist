import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractTegValues, type ExtractResult } from "@/lib/teg-extract.functions";
import { saveValues, EMPTY_VALUES } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { PARAM_META, type TegValues } from "@/lib/teg-algorithm";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Capture TEG 6s — Blood Product Advisor" },
      {
        name: "description",
        content:
          "Point your camera at the TEG 6s display and the app will read the values automatically.",
      },
    ],
  }),
  component: Capture,
});

// How often we send a frame to the AI vision endpoint while scanning.
const SCAN_INTERVAL_MS = 2500;
// Downscale long edge before sending — keeps payloads small and fast.
const MAX_EDGE_PX = 900;
// Require this many values read in a single frame before considering it.
const MIN_VALUES_PER_FRAME = 3;
// Require this many consecutive frames whose overlapping keys agree.
const STABILITY_REQUIRED = 2;
const TOLERANCE = { abs: 0.3, rel: 0.05 }; // 0.3 unit OR 5% — whichever larger.

const KEYS: (keyof TegValues)[] = ["CK_R", "CKH_R", "CRT_MA", "CFF_MA", "CK_LY30"];

// A rolling map of per-key confirmations across the whole scan window.
// Each frame with a value for `k` either agrees with the current candidate
// (bump `hits`) or replaces it (reset to 1). A key is "confirmed" once its
// hits reach STABILITY_REQUIRED — and stays confirmed even if a later frame
// happens to miss that key, so we no longer discard values just because the
// most recent pair of frames didn't overlap on them.
type Confirmation = { value: number; hits: number };
type ConfirmMap = Partial<Record<keyof TegValues, Confirmation>>;

function agrees(a: number, b: number): boolean {
  const tol = Math.max(TOLERANCE.abs, Math.abs(a) * TOLERANCE.rel);
  return Math.abs(a - b) <= tol;
}

function countConfirmed(c: ConfirmMap): number {
  return KEYS.reduce(
    (n, k) => n + ((c[k]?.hits ?? 0) >= STABILITY_REQUIRED ? 1 : 0),
    0,
  );
}

function countRead(v: TegValues): number {
  return KEYS.reduce((n, k) => n + (v[k] !== null ? 1 : 0), 0);
}


async function captureFrameAsDataUrl(video: HTMLVideoElement): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

type ScanState = "idle" | "starting" | "scanning" | "locked" | "error";

function Capture() {
  const navigate = useNavigate();
  const extract = useServerFn(extractTegValues);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const confirmRef = useRef<ConfirmMap>({});
  const cancelledRef = useRef(false);
  // Identifies the current scan run. A loop from an earlier run keeps its own
  // token, so restarting the scanner can never leave two loops racing.
  const runIdRef = useRef(0);
  const singlePhotoAttemptRef = useRef<symbol | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<TegValues>(EMPTY_VALUES);
  const [latestNotes, setLatestNotes] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);

  const stopCamera = useCallback(() => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(
    () => () => {
      stopCamera();
      singlePhotoAttemptRef.current = null;
    },
    [stopCamera],
  );

  const finishWith = useCallback(
    (vals: TegValues) => {
      setState("locked");
      stopCamera();
      saveValues(vals);
      // Brief pause so the user sees the "locked" indicator.
      setTimeout(() => navigate({ to: "/review" }), 600);
    },
    [navigate, stopCamera],
  );

  const scanLoop = useCallback(async (runId: number) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // This run is alive only while it is still the newest one AND not cancelled.
    const dead = () => cancelledRef.current || runIdRef.current !== runId;
    while (!dead()) {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await sleep(300);
        continue;
      }
      const dataUrl = await captureFrameAsDataUrl(video);
      if (dead()) return;
      if (!dataUrl) {
        await sleep(SCAN_INTERVAL_MS);
        continue;
      }
      let result: ExtractResult;
      try {
        result = await extract({ data: { imageDataUrl: dataUrl } });
      } catch (e) {
        if (dead()) return;
        const msg = e instanceof Error ? e.message : "Extraction failed";
        if (/rate limit|credits/i.test(msg)) {
          setError(msg);
          setState("error");
          stopCamera();
          return;
        }
        await sleep(SCAN_INTERVAL_MS);
        continue;
      }
      if (dead()) return;
      setScanCount((n) => n + 1);
      const vals: TegValues = {
        CK_R: result.CK_R,
        CKH_R: result.CKH_R,
        CRT_MA: result.CRT_MA,
        CFF_MA: result.CFF_MA,
        CK_LY30: result.CK_LY30,
      };
      setLatest(vals);
      setLatestNotes(result.notes ?? "");

      // Fold this frame into the rolling per-key confirmation map. A key
      // stays confirmed once it hits STABILITY_REQUIRED, even if later
      // frames drop it — so partial-overlap frames still make progress.
      const confirm = confirmRef.current;
      for (const k of KEYS) {
        const v = vals[k];
        if (v === null) continue;
        const existing = confirm[k];
        if (existing && agrees(existing.value, v)) {
          // Update to the most recent reading; the hit count is what matters.
          confirm[k] = { value: v, hits: existing.hits + 1 };
        } else {
          confirm[k] = { value: v, hits: 1 };
        }
      }

      if (countConfirmed(confirm) >= MIN_VALUES_PER_FRAME) {
        const merged: TegValues = { ...EMPTY_VALUES };
        for (const k of KEYS) {
          const c = confirm[k];
          if (c && c.hits >= STABILITY_REQUIRED) merged[k] = c.value;
        }
        finishWith(merged);
        return;
      }
      await sleep(SCAN_INTERVAL_MS);
    }
  }, [extract, finishWith, stopCamera]);


  const startScanning = useCallback(async () => {
    setError(null);
    setState("starting");
    cancelledRef.current = false;
    // Invalidate any previous run and claim this one.
    const runId = ++runIdRef.current;
    // A pending single-photo request must not overwrite the scanner's state.
    singlePhotoAttemptRef.current = null;
    confirmRef.current = {};
    setLatest(EMPTY_VALUES);
    setScanCount(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");
      video.srcObject = stream;
      await video.play();
      setState("scanning");
      void scanLoop(runId);
    } catch (e) {
      // Release any track that was granted before the failure.
      stopCamera();
      setState("error");
      const msg = e instanceof Error ? e.message : "Could not access camera";
      setError(
        /denied|permission/i.test(msg)
          ? "Camera permission denied. Use the single-photo or manual entry option below."
          : msg,
      );
    }
  }, [scanLoop, stopCamera]);

  const stopScanning = useCallback(() => {
    stopCamera();
    setState("idle");
  }, [stopCamera]);

  const useCurrentReading = useCallback(() => {
    if (countRead(latest) === 0) return;
    finishWith(latest);
  }, [latest, finishWith]);

  // Belt-and-braces client-side timeout. The server function already caps
  // its own upstream fetch at 30s, but a stalled TCP path between browser
  // and server would still leave the UI in "starting…" forever.
  const SINGLE_PHOTO_TIMEOUT_MS = 45_000;

  async function onSinglePhoto(file: File) {
    setError(null);
    // A live scan must not keep running (and possibly auto-advance) underneath
    // a single-photo request.
    stopCamera();
    setState("starting");
    // Track this specific attempt so an in-flight response that arrives
    // after the user has stopped/navigated cannot flip state back.
    const attemptId = Symbol("single-photo");
    singlePhotoAttemptRef.current = attemptId;
    const stillCurrent = () => singlePhotoAttemptRef.current === attemptId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Phone photos are routinely 4–12 MP; sending the raw file can exceed
      // the server's payload limit and is far slower than it needs to be.
      // Downscale to the same long edge the live scanner uses.
      const dataUrl = await downscaleFileToDataUrl(file);
      const result = await Promise.race([
        extract({ data: { imageDataUrl: dataUrl } }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Request timed out. Please try again or enter values manually.")),
            SINGLE_PHOTO_TIMEOUT_MS,
          );
        }),
      ]);
      if (!stillCurrent()) return;
      saveValues({
        CK_R: result.CK_R,
        CKH_R: result.CKH_R,
        CRT_MA: result.CRT_MA,
        CFF_MA: result.CFF_MA,
        CK_LY30: result.CK_LY30,
      });
      navigate({ to: "/review" });
    } catch (e) {
      if (!stillCurrent()) return;
      setState("error");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  const manualEntry = () => {
    stopCamera();
    saveValues(EMPTY_VALUES);
    navigate({ to: "/review" });
  };

  const readNow = countRead(latest);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground underline">
            ← Back
          </Link>
          <Logo size={28} withWordmark />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Capture results</h1>
        <DisclaimerBanner compact />

        <section className="rounded-lg border bg-card p-5 text-card-foreground">
          <h2 className="font-semibold">Point camera at the TEG 6s screen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hold the results panel (CK, CKH, CRT, CFF) steady in the frame.
            The app reads the values automatically and advances when the
            reading stabilises.
          </p>

          <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-md border bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            {/* Targeting reticle */}
            {state === "scanning" && (
              <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <div className="absolute -top-px left-0 h-0.5 w-8 bg-primary" />
                <div className="absolute -top-px right-0 h-0.5 w-8 bg-primary" />
                <div className="absolute -bottom-px left-0 h-0.5 w-8 bg-primary" />
                <div className="absolute -bottom-px right-0 h-0.5 w-8 bg-primary" />
                <div className="absolute top-0 -left-px h-8 w-0.5 bg-primary" />
                <div className="absolute bottom-0 -left-px h-8 w-0.5 bg-primary" />
                <div className="absolute top-0 -right-px h-8 w-0.5 bg-primary" />
                <div className="absolute bottom-0 -right-px h-8 w-0.5 bg-primary" />
              </div>
            )}
            {state === "scanning" && (
              <div className="absolute left-2 top-2 inline-flex items-center gap-2 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Scanning… frame {scanCount}
              </div>
            )}
            {state === "locked" && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
                <div className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  ✓ Reading locked
                </div>
              </div>
            )}
            {state === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Camera off
              </div>
            )}
            {state === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Starting camera…
              </div>
            )}
          </div>

          {/* Live readout */}
          {(state === "scanning" || state === "locked") && (
            <div className="mt-3 rounded-md border border-border bg-background/60 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Live reading ({readNow}/5)</span>
                {latestNotes && <span className="truncate pl-2 italic">{latestNotes}</span>}
              </div>
              <dl className="grid grid-cols-5 gap-1 text-center">
                {KEYS.map((k) => (
                  <div key={k} className="rounded bg-card px-1 py-1.5">
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      {PARAM_META[k].label}
                    </dt>
                    <dd className="font-mono text-sm">
                      {latest[k] === null ? "—" : latest[k]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {state === "idle" && (
            <button
              onClick={startScanning}
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start auto-scan
            </button>
          )}
          {state === "scanning" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={stopScanning}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Stop
              </button>
              <button
                onClick={useCurrentReading}
                disabled={readNow === 0}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Use current reading
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        <div className="text-center text-xs uppercase tracking-widest text-muted-foreground">
          or
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSinglePhoto(f);
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Take single photo
          </button>
          <button
            onClick={manualEntry}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Enter manually
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You will review and confirm every value before any recommendation is shown.
        </p>
      </div>
    </main>
  );
}
