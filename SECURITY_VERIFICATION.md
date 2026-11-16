# Post-security candidate verification

Checked on 2026-11-16; dependency candidate commit:
`2fbbe5bb6a5f40267f14b77d55a7e2f8e389d6d2`.
The prepared patch was already committed when these checks started; no dependency or application-code changes were needed.

## Results

- `bunx vitest run src/lib/teg-algorithm.test.ts`: 54/54 tests passed.
- `oj typecheck -b --noEmit`: exit 0, no diagnostics.
- `bun audit`: no vulnerabilities across 596 packages.
- Production dependency scan: no known vulnerabilities in 53 production dependencies.
- Hosted build status: succeeded, in sync with candidate commit; run `br_cd4baa96-6fa3-4cf1-8bf8-c5de2034c79f`, finished `2026-11-16T11:47:36Z`. No structured build diagnostics. This is hosted production-compilation evidence, not a new manual build or a production publication.
- Local browser check repeated at desktop (1280 × 1800) and phone (390 × 844) sizes: home, rules and algorithm returned HTTP 200; all three diagrams rendered; empty review/results sessions redirected to capture; disclaimer → manual entry → review → recommendation succeeded; review and results retained synthetic values after reload. No browser console errors or uncaught errors. Screenshots inspected.
- Current automatic build log: `build OK` at `2026-11-16T14:28:19Z`; repeated TypeScript check and 54-test suite passed.
- Anonymous hosted-preview check: blocked. Home, rules and algorithm redirected to `https://lovable.dev/auth-bridge`; HTTP 200 belonged to the access screen, not the app. Hosted app rendering without errors therefore remains unverified. No access controls were changed or bypassed.
- No real case information, camera images, AI calls, credentials, migrations, production writes or publication were used.

## Exact resolved versions

| Package | Bun resolution |
| --- | --- |
| @tanstack/react-start | 1.169.5 |
| @tanstack/start-server-core | 1.169.45 |
| @tanstack/react-router | 1.170.46 |
| @tanstack/router-plugin | 1.169.0 |
| dompurify | 3.4.18 |
| seroval | 1.8.1 |
| zod | 4.6.7 |
| vite | 8.3.8 |
| vitest | 5.1.0 |
| katex | 0.18.11 |
| minimatch | 11.0.8 |

Versions were read from Bun's installed resolution tree corresponding to the committed text lockfile.