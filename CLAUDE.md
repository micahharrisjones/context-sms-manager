# Aside: development and migration handoff

Start with [the migration handoff](docs/CLAUDE_CODE_HANDOFF.md) and
[the API inventory](docs/API_CONNECTIONS.md). The current deployment has **not**
been migrated. No external host or production cutover has been approved.

## Product and boundaries

Aside is a personal library of SMS/MMS saves, links, photos, and notes, with
private/shared boards and AI-assisted retrieval. This is an existing application,
not a request to rebuild it.

- Preserve custom phone/SMS authentication. Do not introduce Replit Auth, Clerk,
  or a new identity system as part of the move.
- Keep OpenAI as the app's existing AI provider unless the owner explicitly
  requests otherwise. Claude Code is the development tool, not a provider swap.
- Preserve original saved URLs, board names, membership checks, photo consent,
  existing extracts/embeddings, and daily processing limits.
- Do not add social-account logins to solve preview failures.
- Keep save cards focused on their content; do not restore per-card indexing
  coverage/retry panels. The search-upgrade modal owns its progress summary.
- Do not combine migration with unrelated UI, data-model, or AI rewrites.

## Code map

- `client/src/`: React/Vite UI; pages, components, hooks, API/analytics helpers.
- `server/index.ts`: Express startup, sessions, static hosting, listen settings.
- `server/routes.ts`: application routes, SMS ingestion, signup, scheduled work.
- `server/storage.ts`: application persistence and existing visibility rules.
- `server/db.ts`: Neon WebSocket PostgreSQL driver and Drizzle connection.
- `shared/schema.ts`: shared database schema, including vector/indexing state.
- `server/knowledge/`: ingestion, retrieval, provider calls, library scans.
- `server/crypto-utils.ts`: encryption; existing data needs the effective old key.
- `server/twilio-service.ts`, `server/s3-service.ts`, `server/og-service.ts`:
  provider integrations.
- `docs/knowledge-base.md`, `docs/hey-aside-sms.md`,
  `docs/knowledge-analytics.md`: additional feature contracts and test caveats.
- `.agents/memory/MEMORY.md`: project decisions; verify remembered facts against
  current code before relying on them.

## Local workflow

Use the committed lockfile and `npm ci`; do not silently upgrade dependencies.
Setup and environment-loading commands are in the handoff. The current workspace
baseline is Node 20.20.0, **not a certification for a new production runtime**.
Validate a supported Node LTS and native/browser dependencies before deployment.

Useful scripts, all defined in `package.json`:

```sh
npm run check
npm run build
npm run test:knowledge
npm run test:previews
```

Database integration tests require explicit opt-in, a disposable database,
and no competing app worker. Never run them against production.
Browser fixtures are not live SMS delivery or real-account acceptance tests.

## Migration safety

- Never read secrets aloud, put them in prompts/reports, commit them, or expose
  private keys through `VITE_*`. `.env.example` contains names and blanks only.
- Git contains application code, not production records, media, secret values,
  provider-account ownership, or DNS settings.
- Preserve the **effective existing encryption key**, including investigating
  whether a fallback was used. A newly generated key cannot decrypt old records.
- Do not start the current app against a production copy until background
  workers/schedules are controlled. They start automatically.
- No production SQL, `db:push`, export, DNS/webhook change, provider-key rotation,
  deployment shutdown, or other cutover action without explicit owner approval.
- No force-push, destructive schema sync, unauthenticated test route, or temporary
  login/signature bypass. Preserve access isolation and verify signed webhooks.
- Begin with one active application/worker instance. Audit in-memory sessions,
  rate limits, deduplication, and acknowledged SMS replies before scaling.
- If code changes are authorized, make a coherent small batch, test it, and
  report what was actually verified versus what still needs live acceptance.

## First task for the next developer

Read the handoff, confirm access to provider accounts and production data with
the owner, and propose the external host/database and the smallest portability
patch. Do **not** start by exporting production or launching a second writer.
