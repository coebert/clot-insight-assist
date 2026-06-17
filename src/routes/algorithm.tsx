import { createFileRoute, Link } from "@tanstack/react-router";
import { Mermaid } from "@/components/Mermaid";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Logo } from "@/components/Logo";
import { CITATION } from "@/lib/teg-algorithm";

export const Route = createFileRoute("/algorithm")({
  head: () => ({
    meta: [
      { title: "Algorithm — Clot Clarity" },
      {
        name: "description",
        content:
          "Decision trees and reference ranges used by Clot Clarity to interpret TEG 6s results.",
      },
    ],
  }),
  component: AlgorithmPage,
});

const MAIN_FLOW = `flowchart TD
  Start([TEG 6s values entered])
  Start --> R1{CK.R > R_max?}
  R1 -- No --> R2
  R1 -- Yes --> Hep{CK.R − CKH.R > 2 min?}
  Hep -- Yes --> Prot["**Protamine**<br/>Residual heparin<br/>(per local protocol)"]
  Hep -- No --> FFP["**FFP** 10–15 mL/kg<br/>Factor deficiency"]
  Prot --> R2
  FFP --> R2

  R2{CFF.MA < Fib_low?}
  R2 -- Yes --> Cryo["**Cryoprecipitate**<br/>or fibrinogen concentrate<br/>(cryo 1 u / 10 kg, or<br/>fib conc 25–50 mg/kg)"]
  R2 -- No --> R3
  Cryo --> R3

  R3{CRT.MA < Plt_low<br/>AND CFF.MA ≥ Fib_low?}
  R3 -- Yes --> Plt["**Platelets**<br/>1 adult dose"]
  R3 -- No --> R4
  Plt --> R4

  R4{CK.LY30 > LY_high?}
  R4 -- Yes --> TXA["**Tranexamic acid**<br/>1 g IV"]
  R4 -- No --> Done
  TXA --> Done

  Done([Display recommendation])

  classDef action fill:#3a1418,stroke:#dc2638,stroke-width:2px,color:#fff;
  classDef decision fill:#1f2230,stroke:#6b7280,color:#fafafa;
  classDef start fill:#0f1115,stroke:#dc2638,color:#fafafa;
  class Prot,FFP,Cryo,Plt,TXA action;
  class R1,Hep,R2,R3,R4 decision;
  class Start,Done start;
`;

const THRESHOLDS = `flowchart LR
  subgraph STD[Standard adult]
    direction TB
    S1["R_max = 10 min"]
    S2["Fib_low = 15 mm"]
    S3["Plt_low = 52 mm"]
    S4["LY_high = 3 %"]
  end
  subgraph PRG[Pregnant — 3rd trimester]
    direction TB
    P1["R_max = 9 min"]
    P2["Fib_low = 20 mm<br/>(target ≥ 2 g/L)"]
    P3["Plt_low = 55 mm"]
    P4["LY_high = 2.6 %"]
  end
  STD --- PRG

  classDef std fill:#1f2230,stroke:#6b7280,color:#fafafa;
  classDef prg fill:#3a1418,stroke:#dc2638,color:#fafafa;
  class S1,S2,S3,S4 std;
  class P1,P2,P3,P4 prg;
`;

const RANGES = `flowchart TB
  T["TEG 6s reference ranges<br/>(Global Hemostasis cartridge)"]
  T --> CK["**CK.R** — factor activity<br/>Adult: 4.6 – 9.1 min<br/>Pregnancy: 4.6 – 8.7 min"]
  T --> CKH["**CKH.R** — heparinase channel<br/>Compared to CK.R<br/>Δ > 2 min ⇒ heparin effect"]
  T --> CRT["**CRT.MA** — clot strength<br/>Adult: 52 – 70 mm<br/>Pregnancy: 60 – 73 mm"]
  T --> CFF["**CFF.MA** — fibrinogen<br/>Adult: 15 – 32 mm<br/>Pregnancy: 18 – 41 mm"]
  T --> LY["**CK.LY30** — fibrinolysis<br/>Adult: < 3 %<br/>Pregnancy: < 2.6 %"]

  classDef hub fill:#3a1418,stroke:#dc2638,color:#fff;
  classDef leaf fill:#1f2230,stroke:#6b7280,color:#fafafa;
  class T hub;
  class CK,CKH,CRT,CFF,LY leaf;
`;

function AlgorithmPage() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground underline">
            ← Home
          </Link>
          <Logo size={28} withWordmark />
        </div>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Transparency
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            How recommendations are made
          </h1>
          <p className="text-muted-foreground">
            Clot Clarity uses a transparent, rule-based decision tree — no AI in
            the decision path. The vision model only reads numbers from the
            screen; every threshold below is fixed and auditable.
          </p>
        </header>

        <DisclaimerBanner />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Decision tree</h2>
          <p className="text-sm text-muted-foreground">
            Each entered value is checked in order. Multiple recommendations can
            fire from a single result set (e.g. FFP + cryoprecipitate).
          </p>
          <Mermaid chart={MAIN_FLOW} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Thresholds: adult vs pregnancy</h2>
          <p className="text-sm text-muted-foreground">
            Ticking the "patient is pregnant" box on the review screen swaps the
            thresholds used in the tree above.
          </p>
          <Mermaid chart={THRESHOLDS} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Reference ranges</h2>
          <Mermaid chart={RANGES} />
        </section>

        <section className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-semibold">Source</h2>
          <p className="mt-1 text-xs text-muted-foreground">{CITATION}</p>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/capture"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start a new analysis
          </Link>
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
