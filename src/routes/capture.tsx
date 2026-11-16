import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractTegValues } from "@/lib/teg-extract.functions";
import { clearValues, saveValues, EMPTY_VALUES } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { KEYS, PARAM_META, type TegValues } from "@/lib/teg-algorithm";
import { CaptureRun, coherentFrame, extractValues, validatePhoto } from "@/lib/teg-capture";
export const Route = createFileRoute("/capture")({ head: () => ({ meta: [{ title: "Capture — Clot Clarity" }, { name: "description", content: "Read completed original TEG 6s Global Hemostasis results or enter manually, with cloud photo consent." }, { property: "og:title", content: "Capture — Clot Clarity" }, { property: "og:description", content: "Camera and manual entry for completed original TEG 6s results." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Capture });
function frame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d"); if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
async function photo(file: File) {
  validatePhoto(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Photo could not be decoded. Choose another image or enter manually.")); image.src = url; });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 900 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Photo could not be prepared. Enter manually.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}
function Capture() {
  const navigate = useNavigate(); const extract = useServerFn(extractTegValues);
  const videoRef = useRef<HTMLVideoElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null); const run = useRef(new CaptureRun());
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "locked" | "error">("idle");
  const [error, setError] = useState(""); const [consent, setConsent] = useState(false);
  const [latest, setLatest] = useState<TegValues>(EMPTY_VALUES); const [count, setCount] = useState(0);
  const stop = useCallback(() => { run.current.stop(); streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; }, []);
  useEffect(() => () => stop(), [stop]);
  const finish = useCallback((values: TegValues) => {
    stop(); clearValues(); saveValues(values); setState("locked");
    const token = run.current.start();
    run.current.later(token, () => navigate({ to: "/review" }), 600);
  }, [navigate, stop]);
  async function scan() {
    if (!consent) return;
    stop(); const token = run.current.start(); setError(""); setState("starting"); setLatest(EMPTY_VALUES); setCount(0);
    let previous: TegValues | null = null;
    let frames = 0;
    try {
      const stream = await run.current.camera(token, () => navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }));
      if (!stream || !run.current.alive(token)) return;
      streamRef.current = stream;
      const video = videoRef.current; if (!video) { stop(); return; }
      video.srcObject = stream; await video.play();
      if (!run.current.alive(token)) { stream.getTracks().forEach(t => t.stop()); return; }
      setState("scanning");
      // Hard cap prevents persistent unreadable screens or failures consuming credits forever.
      for (let attempt = 0; attempt < 8 && run.current.alive(token); attempt++) {
        const dataUrl = frame(video);
        if (!dataUrl) throw new Error("Camera has no readable frame. Retry or enter manually.");
        const result = await run.current.wait(token, () => extract({ data: { imageDataUrl: dataUrl, cloudConsent: true } }));
        if (!run.current.alive(token)) return;
        const values = extractValues(result); setLatest(values); setCount(++frames);
        const stable = coherentFrame(previous, values); previous = values;
        if (stable) { finish(stable); return; }
        await run.current.wait(token, () => new Promise<void>(resolve => setTimeout(resolve, 2500)));
      }
      if (run.current.alive(token)) throw new Error("No consecutive coherent readings after 8 frames. Re-check completed results and try again, or enter manually.");
    } catch (e) {
      if (!run.current.alive(token)) return;
      stop(); setState("error"); setError(e instanceof Error ? e.message : "Camera reading failed. Enter manually.");
    }
  }
  async function single(file: File) {
    if (!consent) return;
    stop(); const token = run.current.start(); setState("starting"); setError("");
    try {
      const dataUrl = await run.current.wait(token, () => photo(file));
      if (!run.current.alive(token)) return;
      const result = await run.current.wait(token, () => extract({ data: { imageDataUrl: dataUrl, cloudConsent: true } }));
      if (!run.current.alive(token)) return;
      const values = extractValues(result);
      if (KEYS.every(k => values[k] === null)) throw new Error("No completed results could be read. Enter manually or choose another photo.");
      finish(values);
    } catch (e) {
      if (!run.current.alive(token)) return;
      stop(); setState("error"); setError(e instanceof Error ? e.message : "Photo reading failed. Enter manually.");
    }
  }
  function manual() { stop(); clearValues(); saveValues(EMPTY_VALUES); navigate({ to: "/review" }); }
  return <main className="min-h-screen px-4 py-8"><div className="mx-auto max-w-xl space-y-6">
    <div className="flex justify-between"><Link to="/" className="text-sm text-muted-foreground underline">← Back</Link><Logo size={28} withWordmark /></div>
    <h1 className="text-2xl font-bold">Capture results</h1><DisclaimerBanner compact />
    <section className="space-y-3 border-y border-border py-4"><h2 className="font-semibold">Before sending any photo</h2><p className="text-sm text-muted-foreground">Photos and live camera frames leave your device and are sent to cloud AI for reading. Frame only completed original TEG 6s Global Hemostasis results (CK, CKH, CRT, CFF). Keep patient names, identifiers and other screens outside the frame. Do not upload patient-identifiable images. Manual entry sends no photo.</p><label className="flex items-start gap-3"><Checkbox checked={consent} onCheckedChange={c => { setConsent(c === true); if (c !== true) { stop(); setState("idle"); } }} />I consent to sending non-identifiable result images to cloud AI.</label></section>
    <div className="relative aspect-[3/4] overflow-hidden rounded-md border bg-background"><video ref={videoRef} className="h-full w-full object-contain" playsInline muted aria-label="TEG camera preview" /><div className="absolute left-2 top-2 bg-background/90 p-2 text-sm">{state === "scanning" ? `Scanning… frame ${count}/8` : state === "starting" ? "Preparing reading…" : state === "locked" ? "Reading ready for verification" : "Camera off"}</div></div>
    {KEYS.some(k => latest[k] !== null) && <dl className="grid grid-cols-5 gap-1 text-center text-xs">{KEYS.map(k => <div key={k}><dt>{PARAM_META[k].label}</dt><dd className="font-mono">{latest[k] ?? "—"}</dd></div>)}</dl>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {(state === "idle" || state === "error") && <Button className="w-full" disabled={!consent} onClick={() => void scan()}>{state === "error" ? "Try auto-scan again" : "Start auto-scan"}</Button>}
    {(state === "starting" || state === "scanning" || state === "locked") && <Button variant="outline" className="w-full" onClick={() => { stop(); setState("idle"); }}>Stop</Button>}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label="Result photo" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void single(f); }} />
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={!consent} onClick={() => fileRef.current?.click()}>Take single photo</Button><Button variant="outline" onClick={manual}>Enter manually</Button></div>
  </div></main>;
}
