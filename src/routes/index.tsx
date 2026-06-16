import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ackDisclaimer } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TEG 6s Blood Product Advisor" },
      {
        name: "description",
        content:
          "Clinician decision-support tool that reads Haemonetics TEG 6s results and suggests blood product transfusion based on standard cartridge cutoffs.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Viscoelastic decision support
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            TEG 6s Blood Product Advisor
          </h1>
          <p className="text-muted-foreground">
            Capture the Haemonetics TEG 6s display with your phone (or enter
            values manually) and get a transfusion suggestion based on the
            standard Global Hemostasis cartridge cutoffs.
          </p>
        </header>

        <DisclaimerBanner />

        <section className="rounded-lg border bg-card p-5 text-card-foreground">
          <h2 className="text-base font-semibold">Before you continue</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• You are a licensed clinician using this as an adjunct.</li>
            <li>• You will verify every extracted value before relying on it.</li>
            <li>
              • Recommendations consider TEG only — not the full clinical picture.
            </li>
            <li>• No patient identifiers will be entered. No data is stored.</li>
          </ul>
          <button
            onClick={() => {
              ackDisclaimer();
              navigate({ to: "/capture" });
            }}
            className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            I understand — continue
          </button>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/capture" className="underline">
            Skip to manual entry
          </Link>
        </p>
      </div>
    </main>
  );
}
