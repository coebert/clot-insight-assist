import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    themeVariables: {
      // Match the app's crimson-on-slate palette.
      background: "transparent",
      primaryColor: "#3a1418",
      primaryTextColor: "#fafafa",
      primaryBorderColor: "#dc2638",
      lineColor: "#dc2638",
      secondaryColor: "#1f2230",
      tertiaryColor: "#1a1d28",
      tertiaryTextColor: "#f5f5f5",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    },
    flowchart: { htmlLabels: true, curve: "basis", padding: 12 },
  });
  initialized = true;
}

export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "_");
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureInit();
    (async () => {
      try {
        const out = await mermaid.render(`m-${id}`, chart);
        if (!cancelled) setSvg(out.svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Diagram error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        {error}
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className="mermaid-host overflow-x-auto rounded-lg border border-border bg-card/60 p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}
