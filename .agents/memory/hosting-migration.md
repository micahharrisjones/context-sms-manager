---
name: Hosting migration direction
description: User-stated intention to move Aside off Replit and the scope of migration planning.
---

The user intends to move Aside off the Replit platform. They asked for a migration approach that accounts for existing API connections.

**Why:** The user explicitly stated this direction after synchronizing the project with GitHub, then approved preparing a repository handoff—not executing the migration.

**How to apply:** Treat this as a migration of the existing application, not permission to rewrite its authentication, change AI providers, discard integrations, or cut over production. Distinguish development tooling from runtime hosting. Include production data, encrypted settings, storage, background work, webhook routing, analytics, and rollback in migration planning. No destination host or cutover has been approved yet.
