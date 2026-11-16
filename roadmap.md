# Dependency security remediation

- [x] Upgrade compatible TanStack packages and patched sanitization/serialization dependencies.
- [x] Audit the full Bun lockfile, including Zod, Vite, and development/transitive packages; apply compatible fixes.
- [x] Verify resolved versions, TypeScript, 54 tests, local session guards, diagrams, and successful hosted production compilation.
- [ ] Verify anonymous hosted-preview rendering: blocked by redirect to Lovable sign-in; no access settings changed.
- [x] Save dependency patch (2fbbe5bb6a5f40267f14b77d55a7e2f8e389d6d2) and record candidate-check results and blocker.