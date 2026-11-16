# Clinical safety and workflow correction

- [x] Resume QA from 466aaab; inspect newer work, correct versioned intervals and WHO 2025.
- [x] Finish full regression/lint/types, automatic production compilation, synthetic desktop/mobile and mocked capture verification.
- [x] Record findings and limitations; commit without publishing.

- [x] Correct engine validation, clinical context, reference intervals and conditional findings.
- [x] Bind display verification to exact session values/context and harden storage/reset.
- [x] Correct camera cancellation, coherent frames, OCR rejection and cloud consent.
- [x] Align rules, diagrams and citations with the engine.
- [x] Run regression tests and synthetic desktop/mobile flows; record verification and commit without publishing.

## Earlier dependency security remediation

- [x] Upgrade compatible TanStack packages and patched sanitization/serialization dependencies.
- [x] Audit the full Bun lockfile, including Zod, Vite, and development/transitive packages; apply compatible fixes.
- [x] Verify resolved versions, TypeScript, 54 tests, local session guards, diagrams, and successful hosted production compilation.
- [ ] Verify anonymous hosted-preview rendering: blocked by redirect to Lovable sign-in; no access settings changed.
- [x] Save dependency patch (2fbbe5bb6a5f40267f14b77d55a7e2f8e389d6d2) and record candidate-check results and blocker.