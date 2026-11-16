# Dependency maintenance

- Use Bun and its text lockfile for dependency remediation so installations and audits share one authoritative resolution.
- Keep security overrides limited to vulnerable transitive packages whose parent ranges exclude patched versions; verify the parent integrations before removing or changing them.

# Clinical workflow architecture

- Clinical cases use a lazily created browser-only session store; SSR exports return empty values and mutations are no-ops to prevent cross-request state sharing.
- Begin a case atomically only after a successful new capture or an explicit new-case action; ordinary edits and cancelled capture preserve intentional context while revoking verification.
- Reference search uses one shared selection for rule sections and unique bibliography counts so label matches retain supporting sources.
- Capture uses generation guards plus transport cancellation and full-body server deadlines; late media acquisition always stops stale tracks.
