import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { clearValues } from "@/lib/teg-store";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Clot Clarity — TEG 6s Clinical Review" },
      {
        property: "og:description",
        content: "Clot Clarity clinical review for original TEG 6s results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Clot Clarity — TEG 6s Clinical Review" },
      {
        name: "description",
        content:
          "Clinician decision-support tool that reads Haemonetics TEG 6s results and supports clinical findings with bleeding context and local protocol correlation.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="space-y-5 text-center">
          <div className="flex justify-center">
            <Logo size={72} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Viscoelastic decision support
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Clot Clarity</h1>
            <p className="mx-auto max-w-md text-muted-foreground">
              Capture the Haemonetics TEG 6s display with your phone, or enter values manually, and
              review clinical findings for the original Global Hemostasis cartridge. Illustrative
              thresholds are not universal treatment cutoffs.
            </p>
          </div>
        </header>

        <DisclaimerBanner />

        <section
          className="rounded-2xl border border-border/70 bg-card/80 p-6 text-card-foreground backdrop-blur"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <h2 className="text-base font-semibold">Before you continue</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">●</span> You are a licensed clinician using this as an
              adjunct.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">●</span> You will verify every extracted value before
              relying on it.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">●</span> Bleeding context and local protocol/lab
              correlation are essential.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">●</span> Do not enter patient identifiers. Values
              remain in this tab session; photos are sent to cloud AI only with your consent.
            </li>
          </ul>
          <Button
            onClick={() => {
              if (!window.confirm("Start a new case and discard any previous values and context?"))
                return;
              clearValues();
              navigate({ to: "/capture" });
            }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            I understand — continue
          </Button>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/capture" className="underline underline-offset-4 hover:text-foreground">
            Skip to manual entry
          </Link>
          <span className="mx-2 opacity-50">·</span>
          <Link to="/algorithm" className="underline underline-offset-4 hover:text-foreground">
            View algorithm & decision tree
          </Link>
          <span className="mx-2 opacity-50">·</span>
          <Link to="/rules" className="underline underline-offset-4 hover:text-foreground">
            Rules reference
          </Link>
        </p>
      </div>
    </main>
  );
}
