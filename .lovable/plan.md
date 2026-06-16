# TEG 6s Interpretation & Blood Product Advisor

A mobile-friendly web app that uses a phone camera to read values off a Haemonetics TEG 6s display, interprets them against the standard Global Hemostasis cartridge cutoffs, and recommends blood products. Single-use, no accounts, no data stored.

## User Flow

1. Landing screen with prominent clinical disclaimer + "I understand, continue" gate.
2. Capture screen:
   - Option A: "Take photo of TEG 6s screen" (uses `<input type="file" accept="image/*" capture="environment">` — works on iOS/Android without native code).
   - Option B: "Enter values manually."
3. After photo capture: image sent to a server endpoint that calls Lovable AI (Gemini multimodal) to extract TEG parameters as structured JSON.
4. Confirmation screen: every extracted value is shown in editable fields. Clinician MUST review/confirm before recommendations appear. Missing values are flagged but allowed.
5. Recommendation screen: shows each abnormal parameter, the rule that fired, and the suggested product(s) with dose guidance. Includes "Start over" and "Print/Save PDF" (browser print).

## Interpretation Algorithm

Based on Haemonetics TEG 6s Global Hemostasis cartridge (CK, CRT, CFF, CKH) standard reference ranges. The algorithm is encoded as transparent, auditable rules in `src/lib/teg-algorithm.ts` with citations shown in the UI.

Parameters extracted:
- **CK.R** (Citrated Kaolin Reaction time, min) — normal ~4.6–9.1
- **CKH.R** (Citrated Kaolin + Heparinase R, min) — compared with CK.R to detect heparin effect
- **CRT.MA** (Citrated RapidTEG Maximum Amplitude, mm) — normal ~52–70; platelet contribution
- **CFF.MA** (Citrated Functional Fibrinogen MA, mm) — normal ~15–32; fibrinogen contribution
- **CK.LY30** (% lysis at 30 min) — normal <3%

Rule ladder (each rule independent, all that fire are recommended):
| Finding | Threshold | Recommendation |
|---|---|---|
| Prolonged CK.R | >10 min | Consider FFP (10–15 mL/kg) — coagulation factor deficiency |
| CKH.R << CK.R | CK.R − CKH.R > 2 min AND CK.R prolonged | Consider protamine — residual heparin effect |
| Low CFF.MA | <15 mm | Consider cryoprecipitate or fibrinogen concentrate — hypofibrinogenemia |
| Low CRT.MA with adequate CFF.MA | CRT.MA <52 AND CFF.MA ≥15 | Consider platelets — thrombocytopenia / platelet dysfunction |
| Elevated LY30 | >3% | Consider antifibrinolytic (e.g. tranexamic acid) — hyperfibrinolysis |
| All values within range | — | No product indicated based on TEG |

Each recommendation card displays: the value(s) that triggered it, the cutoff, the suggested product, and a one-line rationale with a reference citation.

## Disclaimer

Persistent footer + initial gate:
> Decision-support tool for licensed clinicians. Not a medical device. Not FDA or CE cleared. All recommendations require independent clinical confirmation and must be considered in the full clinical context. Verify all extracted values before acting.

## Technical Details

**Stack:** TanStack Start (existing), Tailwind, shadcn/ui. Lovable Cloud + Lovable AI Gateway enabled for the vision call.

**Files:**
- `src/routes/index.tsx` — landing + disclaimer gate
- `src/routes/capture.tsx` — camera/manual entry
- `src/routes/review.tsx` — editable extracted values
- `src/routes/results.tsx` — recommendations
- `src/lib/teg-algorithm.ts` — pure rule engine + types + citations
- `src/lib/teg-extract.functions.ts` — `createServerFn` that POSTs the image (base64 data URL) to `https://ai.gateway.lovable.dev/v1/chat/completions` using `google/gemini-3-flash-preview` with a strict JSON schema response for the five parameters
- Shared store via `sessionStorage` for passing values between routes (no DB; nothing persisted server-side; image is discarded after extraction)

**AI extraction:** Vision prompt instructs Gemini to locate the TEG 6s results panel and return `{ CK_R, CKH_R, CRT_MA, CFF_MA, CK_LY30 }` with `null` for any value it cannot read confidently. No free-text interpretation from the model — interpretation runs entirely in `teg-algorithm.ts`.

**Privacy:** Image is sent to the server function, forwarded once to the AI gateway, and not stored. No patient identifiers requested anywhere. `sessionStorage` only.

## Out of Scope (v1)

- Live video / real-time OCR (photo capture only)
- Saved case history, accounts, audit log
- PlateletMapping (TEG-PM) cartridge
- Trauma MTP-specific or cardiac-specific algorithms (can be added later)
- Patient weight–based dose calculator (doses shown as standard ranges)

## Open Items to Confirm After Plan Approval

- Should weight-based dosing be calculated (would add a weight input field), or keep the standard range text? Default: standard range text.
- Preferred citation to display in-app (e.g. Haemonetics TEG 6s operator manual reference ranges). Default: cite manufacturer reference ranges generically; you can paste an exact citation later.
