# Dependency maintenance

- Use Bun and its text lockfile for dependency remediation so installations and audits share one authoritative resolution.
- Keep security overrides limited to vulnerable transitive packages whose parent ranges exclude patched versions; verify the parent integrations before removing or changing them.