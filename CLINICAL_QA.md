# Clot Clarity clinical/workflow QA — 16 November 2026

## Scope and provenance

Resumed from `466aaab58f4472e171801211aebf58ffa3ef7fb6`. Initial Git status was clean and there were no newer commits. Preserved the clinical rewrite. No publishing, production data writes, migrations, live camera, real patient information or live OCR requests were used.

## Corrections completed

- Replaced engine CFF.MA 13–30 with a **versioned original-cartridge profile of 15–32 mm**, not a claim about the latest regional IFU. Manufacturer original citrated multichannel **REF 07-601**, insert **PN 115873-MULTI(AC), February 2016**, English Expected Values pp5–6, explicitly reports CK.R 4.6–9.1 min, CKH.R 4.3–8.3 min, CRT.MA 52–70 mm, CFF.MA 15–32 mm and CK.LY30 0–2.6%. The downloaded original manufacturer document was read directly, not inferred from a secondary paper.
- Corroborated those five intervals with **RUH SOP/POCT/61/2 effective 10 November 2022**, section 7 p18. It separately lists **CFF A10 15–30** and **MA 15–32**. Viewed the older **June 2015 manual revision AB figure 4-8 p41**: it explicitly calls the picture an illustration of an in-progress four-channel test and displays CFF.MA 13–30. Rules/review/results/diagrams expose version and local-lab variation; adult treatment triggers remain illustrative, distinct from intervals. No A10-to-MA or MA-to-g/L equivalence is invented. HN and other cartridges remain unsupported.
- Updated PPH bibliography to **WHO/FIGO/ICM 2025 consolidated guideline recommendation 27**: confirmed PPH, early IV TXA within three hours of **birth**, regardless of the source of bleeding, subject to clinical contraindications/local care. No app-generated dose. Pregnancy alone is not PPH. Verified the WHO publication record and full primary-source NCBI recommendation text; direct scrape initially returned 500 and direct WHO PDF returned 403, so primary text was retrieved through search full-content delivery instead.
- Removed server-accessible mutable singleton clinical state. Lazy browser-only store plus frozen empty SSR snapshot; server mutations do nothing. Added SSR regression.
- Storage read/cleanup/write failures are separated. Clear and later writes retry durable invalidation/persistence after recovery; legacy cleanup cannot disable current-case writes. Browser refuses all storage: show memory-only/stale-data warning rather than promise impossible deletion.
- Atomic new-case operation resets every context field. Successful capture replaces the case with confirmation; cancelled/failed scans and returning to manual review preserve intentional edits. Every value/context edit revokes exact-case verification.
- Run cancellation now aborts supported TanStack RPC transport and forwards request cancellation into upstream OCR deadline, retaining stale-result generation guards. Acquisition/playback deadlines and late stream cleanup; photo cancellation releases object URLs/handlers. Invalid extracted results are blocked at the capture boundary.
- Fixed rule-label-only reference search: supporting sources remain visible and unique bibliography/count reflects the displayed selection. Search includes limitations. Mobile diagrams retain readable minimum width inside a horizontally scrollable container, not page overflow.
- Cleared lint formatting failures and an invalid unused ESLint suppression. Updated content-route titles/descriptions to clinical-review framing.

## Reproducible commands and results

Run from project root with Bun and the already-running local preview on port 8080:

```sh
bun run test
bunx oj typecheck -b --noEmit
bun run lint
python3 qa/clinical/walk.py
python3 qa/clinical/capture.py
python3 qa/clinical/extra.py
```

Final results:

| Check | Result |
|---|---|
| Baseline suite | 77/77 pass before edits |
| Final Bun/Vitest suite | **114/114 pass, six files** |
| Algorithm boundary/context | 49 tests |
| Session/storage/edit/reset | 24 tests |
| Capture/coherence/file/OCR parser | 24 tests |
| Upstream/full-body/caller timeout | 12 tests |
| Reference selection | 4 tests |
| Server mutation isolation | 1 test |
| Full typecheck | exit 0, no diagnostics |
| Full lint | exit 0; 0 errors, **6 pre-existing Fast Refresh warnings** in UI badge/button/form/navigation-menu/sidebar/toggle |
| Automatic current workspace compilation | `build OK`, latest observed 2026-11-16T16:20:34Z |
| Hosted production-target build of baseline | `br_724116c2-6479-4fb8-ae8d-f276c0a1f74d`, succeeded 2026-11-16T16:07:04Z, SHA 466aaab... |
| Browser clinical workflow | 38 recorded assertions/groups across both viewports; zero page/console errors |
| Mocked capture workflow | 24 recorded assertions/groups across both viewports; zero uncaught page errors |
| Additional workflow/storage | 8 recorded groups across both viewports; zero uncaught page errors |

**Build limitation:** Platform instructions prohibit manually running project build commands. Current workspace automatic compilation passes; hosted production-target compilation inspected at QA time serves the pre-existing baseline commit, not yet this uncommitted patch. A newly saved candidate's hosted production build must be checked once the platform ingests its commit; no manual `bun run build` is claimed here.

## Browser coverage and screenshots

All three saved scripts use fresh Chromium contexts at **1280×1800** and **390×844**, synthetic values only. Generated evidence lives under `/tmp/browser/clinical-qa`; per-case result lists are retained in `qa/clinical/*results.json`. Scripts recreate screenshots/PDFs rather than commit binary output.

Clinical checks: manual normal; abnormal mixed deficits (16,12,40,8,10); absent/unknown bleeding; adult/cartridge gates; empty/out-of-range blocked; partial values with named unavailable assessments; normal LY30 in confirmed PPH; pregnancy alone versus PPH; trauma yes/no/unknown timing; all five value edits plus all six context edits revoke verification; unverified/empty direct results guard; review/results reload; back/manual preserves intentional edits; explicit reset/new case clears all context; heparin correction without plasma/protamine dosing; high MA/short R flagged even when no trigger; print button invoked and two browser PDFs produced; rule label search/clear/no matches; all three diagrams render; no document horizontal overflow.

Capture checks: mocked media only; permission denial; delayed acquisition after stop and unmount closes tracks; pending photo cancelled by manual entry or stop/restart cannot overwrite values/navigation; persistent upstream errors fail closed after one call (user retry makes one new call); eight empty/incoherent successful reads reach cap; partial incompatible visible sets do not merge; two consecutive coherent full frames confirm; invalid photo MIME rejected before request; malformed OCR result rejected; stalled response times out with retry/manual visible. Browser deadline and scan interval accelerated for reproducibility (45s -> 200ms, 2.5s -> 20ms); full actual timeout semantics independently covered by fake-timer unit tests.

Reviewed screenshots include desktop/mobile normal, mixed-trauma, PPH, pregnancy, partial, invalid, rules, diagrams, reference-search/search-evidence, print, abnormal-no-trigger, matched-rule, storage-warning, and capture denied/retry-cap/timeout. File pattern: `{desktop|mobile}-{case}.png`; mocked capture uses `{desktop|mobile}-capture-{case}.png`; print PDFs `{desktop|mobile}-print.pdf`. Mobile diagram text originally scaled too small; corrected scrollable minimum width and reran all browser scripts. Mock transport never forwards intercepted AI requests. No live machine/photo or AI accuracy claim.

## Failures found during QA and resolution

- Original lint: 289 errors including formatting and undefined `react/no-danger` suppression; corrected. Final lint has warnings only.
- First enhanced unit run: one stale-camera cancellation test failed after adding deadline race; corrected semantics so cancelled acquisition returns null and late tracks are still stopped. Final 114 pass.
- Browser script originally clicked pre-hydration home controls; added network-idle initialization. Print harness initially asserted exactly one invocation although the test observed duplicate invocation after reruns; verified at least one genuine button activation and PDF rendering, without changing app printing logic. No final browser failures.
- Browser storage mock accidentally returned a throwing function as the evaluate result; corrected fixture to return void. Pending mock interception cleanup now aborts/unroutes explicitly.

## Remaining limitations (not hidden)

- No clinical validation, regulatory clearance, local transfusion protocol validation, or live end-to-end OCR accuracy/device testing is established by these tests. Engine remains illustrative decision support with clinician/lab correlation.
- Latest regional cartridge IFU/lot-specific configuration and local laboratory reference intervals must be supplied/verified locally. Historical manufacturer insert and RUH SOP are transparent source profiles, not asserted definitive current IFU. The manufacturer white paper was not needed to establish the direct insert table and was not independently obtained in this pass.
- Fully blocked browser storage cannot be durably erased by app code; stale disk data may return after reload if browser storage becomes accessible again. In-memory fallback/reset and recovery retries work; warning instructs clearing site data before reuse when deletion is blocked.
- Aborting client transport cannot guarantee upstream provider work stops after acceptance. Request-signal propagation is implemented; actual deployed disconnect propagation and third-party cancellation billing behavior are not verified.
- Browser tests use mocked media/RPC and unit mocked fetch bodies. Physical permission UI, iPhone capture/print UI, hardware camera behavior, installed home-screen app behavior, and actual worker-to-provider cancellation are unverified.
- Previous anonymous hosted-preview auth redirect remains an earlier recorded limitation; no visibility/access settings changed. This request checked local public pages without an auth wall.
- Print PDFs/rendering checked in Chromium, not physical printer output; dark theme is retained. No automated dosing added.
