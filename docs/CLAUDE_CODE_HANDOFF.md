# Aside: Claude Code and external-host migration

## Status and intent

This handoff prepares a move; it **does not perform one**. No new host has been
selected, production data exported, credentials transferred, DNS/webhooks
changed, runtime patched, or existing deployment shut down.

Use the existing GitHub application, not a fresh scaffold. Claude Code is the
development tool; a separate host runs the service. Keep the first migration
small: same application, providers, number, domain, data and behavior.

Read [CLAUDE.md](../CLAUDE.md), [API inventory](API_CONNECTIONS.md) and
[environment template](../.env.example).

## 1. Obtain access without copying secrets into the repository

- Clone `https://github.com/micahharrisjones/context-sms-manager.git`, open it
  locally, and use your normal Claude Code workflow. Authenticate GitHub locally
  through native GitHub/SSH tooling; Replit connections do not follow the clone.
- Confirm owner/admin access to production hosting, the actual production
  database, AWS bucket, Twilio account/number, OpenAI, preview providers, Pendo
  and the domain's DNS provider.
- Record current provider settings in a private operator record. GitHub is not a
  backup of database records, uploaded images, environment values or DNS.
- Transfer required values directly into the new host's secret manager.
  Never paste them into Claude, commit them, put them in `VITE_*`, or add a
  production environment file to the repo.
- Preserve the effective old `ENCRYPTION_KEY`; restoring rows with a new key
  does not make the encrypted data usable. Confirm whether the source's fallback
  was previously used without publishing its value.

## 2. Reproduce development safely

The observed workspace baseline is Node **20.20.0**. It is not a recommendation
to deploy an old runtime indefinitely. There is no verified external Node LTS
pin yet. Before production, validate a supported LTS, deprecated crypto imports,
AWS SDK requirements, native `sharp` and the browser-test dependencies.

POSIX-shell example, on a compatible Node version:

```sh
git clone https://github.com/micahharrisjones/context-sms-manager.git
cd context-sms-manager
npm ci
cp .env.example .env.local
```

Fill the ignored local file privately with a **disposable Neon-compatible
development database**, unique local session/encryption secrets, and only
isolated resources. Leave real messaging, AI billing and analytics credentials
unset for initial development. The current driver is `@neondatabase/serverless`
with WebSockets; a plain local PostgreSQL URL is not a drop-in replacement.

For an **empty, disposable database only**, enable the `vector` extension through
the database provider's administration tools and review/apply the schema:

```sh
# Confirm DATABASE_URL in the local file is disposable before running this.
node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push
```

This is a schema mutation, not a production migration or a data restore.
Never point it at production or a valuable existing database.

Start development with explicit environment loading:

```sh
node --env-file=.env.local --import tsx server/index.ts
```

The template sets `NODE_ENV=development`. The current app listens on port 5000
for frontend and API together. `npm run dev` does **not** automatically read
`.env.local`; inject the environment separately if using that script.
Without configured test-owned Twilio resources, real SMS login is unavailable.
Use the isolated browser fixtures for UI checks rather than adding an auth
bypass or sending codes to real users.

**Warning:** startup automatically runs background indexing and scheduled work.
There is currently no implemented environment switch to disable all of it.
Do not start against a production database copy until explicit background-work
controls are added and verified. Missing AI keys are not a general read-only
mode and do not prevent database mutations or all external activity.

## 3. Run the available checks

Commands must inherit only isolated test/development configuration:

```sh
npm run check
npm run build
npm run test:knowledge
npx playwright install chromium
npm run test:previews
```

If your configuration exists only in `.env.local`, the knowledge unit suite can
be invoked with explicit loading rather than assuming npm reads the file:

```sh
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run --config vitest.knowledge.config.ts
```

Install the OS libraries required by Playwright on Linux when needed; outside
Replit, tests fall back from `/repl/tools/bin/chromium` to Playwright's installed
Chromium. Native browser launch and a clean `npm ci` are separate checks from a
successful TypeScript/build run.

- `test:previews` runs preview unit tests and an isolated browser fixture server
  on port 5017. It includes knowledge/search browser fixtures as well.
- `test:knowledge:browser` is a separate browser suite using an already-running
  app on port 5000 and test-only API fixtures. It is not a live-user login test.
- `test:knowledge:db` explicitly opts into synthetic database integration tests.
  Use **only a disposable database**, stop any app worker connected to it,
  inject that test database's environment, and then run the script. Its fixtures
  and providers are not a production acceptance test.
- Keep database exports/test output private and outside source control. Do not
  use a real account's saves as fixtures.

Additional contracts: [knowledge base](knowledge-base.md),
[SMS retrieval](hey-aside-sms.md), [analytics](knowledge-analytics.md).

## 4. Approve the destination and the portability patch

Recommended starting architecture, **not yet selected**:

- One always-on Node service on a host such as Render or Railway.
- Owner-controlled Neon PostgreSQL with `pgvector`, unless the existing
  compatible production database can remain in place.
- Existing AWS S3, Twilio, OpenAI and preview-provider accounts.
- Existing `textaside.app` custom domain.

The app serves Express APIs and built React assets together. Preserve same-origin
relative API URLs. Do not split the frontend/backend or switch to serverless
functions just to move hosts: indexing, scheduled work and WebSockets need an
explicit execution model.

**Review and implement these before calling the new deployment ready:**

- [ ] Make normal **and degraded/fallback** listeners honor the target host's
  port contract; current startup fixes both to 5000. Review `reusePort` support.
- [ ] Configure HTTPS proxy trust and secure cookie settings for the actual
  proxy topology. Current sessions have no persistent store and `secure: false`.
  Replace the in-memory store for production; do not bypass authentication.
- [ ] Supply real session/encryption secrets securely and fail closed on
  missing production secrets instead of accepting development fallbacks.
- [ ] Add explicit worker/scheduler controls before starting a restored
  production copy. Use one active scheduled-work owner during transition.
- [ ] Verify scheduled-job timezone, shutdown behavior and indexing leases.
  Timers, SMS deduplication/rate limits and pending SMS replies also include
  in-memory state; don't assume multi-instance delivery is durable.
- [ ] Audit Node/runtime compatibility, Replit development plugins, theme
  generation, native dependencies and clean lockfile installation.
- [ ] Audit hardcoded/public-domain assumptions, short-link allowlists,
  Squarespace CORS, WebSocket proxy upgrades and Twilio's externally signed URL.
  Preserve validation rather than relaxing it for staging.
- [ ] Explicitly configure host-independent custom analytics or document the
  loss of Replit-injected events. Keep Pendo and privacy contracts intact.
- [ ] Set build to `npm ci` then `npm run build`, and runtime to `npm run start`
  with `NODE_ENV=production` and secrets injected by the host. Build needs the
  development dependencies; do not omit them before Vite/esbuild compilation.
- [ ] Configure restart policy, HTTP readiness checks (`/api/health`), logs and
  alerting. A responding HTTP process is not proof of working database/SMS/AI.

These are **pending code/operations tasks**, not changes implemented by this
handoff. No fabricated `PORT`, worker-disable or public-URL variable is wired up
by adding it to an environment file.

## 5. Back up and rehearse a complete production restore

Get explicit owner approval and identify the actual production connection first.
The development database is not a substitute. Do not assume a historically
named secret identifies the live database.

- [ ] Take a provider snapshot and/or a consistent full PostgreSQL backup using
  an approved, database-version-compatible tool. Use a provider/direct TCP
  endpoint for PostgreSQL tools, not the application's WebSocket transport.
  Use a trusted secret mechanism, not a URL containing credentials in shell
  history. Keep backups encrypted/access-controlled and outside this repo.
- [ ] Record PostgreSQL/extension versions, `vector` support, schema, constraints,
  indexes and sequence values. Check restore privileges and ownership handling.
- [ ] Include users, phone/auth records, boards/memberships, saves/media
  references, comments/preferences, short links, AI source text/chunks/vectors,
  jobs/leases, usage counters, consent and library-scan state.
- [ ] Restore into an isolated target. Confirm row counts and relationships,
  membership isolation, decryption using the preserved effective key,
  1536-dimensional vector integrity and next-ID sequences.
- [ ] Keep S3 objects in place unless a separate transfer is approved. Verify
  permissions and actual existing media keys/URLs; don't silently regenerate
  every image reference.
- [ ] Do not recreate vectors through paid AI calls simply because hosting moved.
- [ ] Resume queued/leased work only under the reviewed worker controls. A
  restored snapshot may contain jobs or pending state from the old instance.

If retaining the same production database, a data copy may not be necessary;
still take a tested backup, and do not run two uncoordinated writer/cron setups.
Do not use `db:push` as a substitute for data transfer or a reviewed migration.

## 6. Prove staging with controlled traffic

Use isolated resources and a temporary HTTPS host. Do not repoint the live
Twilio number or production DNS to test staging, send to real users, or add
test-only login routes to the deployed app.

Complete [the provider acceptance checklist](API_CONNECTIONS.md#acceptance-checks).
Exercise signed webhooks through the real reverse proxy with a test-owned number,
old and new S3 images, access boundaries, and search/indexing consent and limits.
Record live checks separately from mocked test success.

Known boundaries to preserve and report:

- The user reported live “Hey Aside” activation problems before this migration;
  compare against a baseline rather than calling an untested move a fix.
- Rich previews on private/blocked sites are not guaranteed. There is an
  outstanding real-iPhone Safari verification gap.
- Older-save scans currently report daily-limit-blocked cards as not indexed;
  automatic continuation after a daily reset is not implemented.
- Save-time indexing enqueue interruptions and in-memory pending SMS replies
  are existing reliability risks, not new durable-queue guarantees.
- Sessions may require one fresh login at cutover even if the signing secret is
  retained, because current sessions live in process memory.

## 7. Coordinated cutover — explicit approval required

Before changing anything, record DNS values/TTL, webhook routes and methods,
callback URLs, provider settings, old deployment version, backup/restore location,
writer ownership, and the go/no-go owner privately.

1. Rehearse rollback and determine how inbound SMS is handled during any write
   freeze. Keep the number active; never return a false successful
   acknowledgement for a message that has not been durably retained.
2. For a database move, establish a consistent final write boundary: approved
   maintenance/queuing or replication strategy, final backup/sync, and a stop
   on old writers/workers before the target becomes authoritative. Decide how
   delayed Twilio deliveries and retries are reconciled.
3. Verify target schema/data/decryption, deploy the reviewed build and enable
   only the intended workers. With a shared database, don't casually shut down
   or duplicate work without a drain/lease handover.
4. Coordinate DNS/TLS, webhook/callback routing and external signature validation.
   Keeping `textaside.app` avoids changing public links, but DNS propagation
   alone does not prevent some traffic reaching the old deployment.
5. Route old-host stragglers to the new authority or safely prevent conflicting
   writes, including worker/cron writes. Do not allow two divergent databases
   to accept saves.
6. Send controlled live tests: login, text save, photo save, private/shared
   access, old image, preview, search and SMS response. Check logs without
   exposing personal content; monitor errors, delivery and queue processing.
7. Keep the old deployment/data available until acceptance and a defined
   monitoring period finish. Then retire it and revoke only obsolete access.
   Do not rotate the encryption key as cleanup.

## 8. Rollback must preserve post-cutover saves

Define rollback triggers and the decision owner before launch: failed SMS/login,
missing saves/media, privacy violations, failed decryption, or sustained
processing failures.

- Stop/drain new writers and pending work before redirecting traffic.
- With a shared database, roll back code only after checking schema compatibility
  and exclusive worker ownership.
- With a new database, **do not simply point DNS back to the stale old database**.
  Restore/reconcile accepted post-cutover saves and delivery state, or run the
  known-good app against the authoritative compatible target database.
- Restore approved routing, revalidate signatures/TLS, and confirm there are no
  duplicate/missing saves, conflicting cron jobs or stranded SMS replies.
- Retain encrypted backups and migration records according to the owner's
  retention policy; don't put them in GitHub.

## Suggested first Claude Code prompt

> Read CLAUDE.md, docs/CLAUDE_CODE_HANDOFF.md and docs/API_CONNECTIONS.md.
> Audit current code against the handoff and propose the smallest portability
> patch for an always-on Node host. Do not export production data, handle secret
> values in chat, change DNS/webhooks, deploy, switch AI/auth providers, or run
> schema mutations without my approval. Preserve saved data, sharing/privacy,
> Twilio number, photo consent and existing AI indexes. Start by confirming
> the host/database choices and the outstanding migration blockers.
