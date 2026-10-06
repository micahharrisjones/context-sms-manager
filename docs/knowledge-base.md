# Aside knowledge base

New web and SMS/MMS saves enqueue persistent, versioned ingestion jobs. Stored image keys enqueue a fresh version when an MMS upload completes. The worker reads at most eight submitted public links, keeps cleaned source text separate from any image interpretations, chunks the evidence, and uses the existing OpenAI `text-embedding-3-small` / PostgreSQL vector(1536) setup. It does not crawl a website.

Search is explicit-submit only. Keyword retrieval remains available without OpenAI; semantic retrieval and concise cited answers use OpenAI when enabled and within budget. Source IDs and verbatim quoted excerpts are validated before displaying an answer. A citation is an inspection aid, not a guarantee of factual accuracy.

## Access and privacy

Default search sees only the requester's own saves. Shared-board search requires an explicit authorized board ID and checks current membership. Hashtag board names are preserved; ambiguous same-name board associations fail closed rather than broadening access. Results and source details are reauthorized after asynchronous work; stale edits and revoked membership invalidate results.

Notes and public page text use the existing AI-enabled default. Photo analysis requires a separate opt-in from the save owner. Before transmission, stored S3 image bytes are checked for supported MIME and magic bytes, limited to 5 MiB / 20 million decoded pixels, re-encoded with metadata removed, and read by `gpt-4o-mini`. OCR and model observations are separate fields. Video, audio, private accounts, paywall bypass and arbitrary externally supplied media URLs are not supported.

Turning general analysis off stops new processing and AI answers; existing source extracts are retained. Turning photo analysis off prevents new photo transmissions, not deletion of previously indexed evidence. In-flight new photo evidence is discarded if consent changes before publication. Deleting a save cascades into its source/chunk records; editing invalidates its previous version. No query, source text, image bytes, session headers or response body is added to knowledge operational logs. Existing preview-provider logging is a separate legacy concern.

## Coverage, limits and recovery

Coverage is explicit: unindexed, queued, processing, ready, partial, blocked, unsupported, failed or paused. Subscription teasers and truncated extracts are partial. A failed page fetch never turns preview metadata into a supposedly complete article. Older saves can still match original text/tags/legacy vectors; their fallback preview evidence is labeled metadata-only.

Per owner per UTC day: 50 ingestions, 5 photo analyses, 100 AI searches and 1,000 embedded passages. Up to eight links and 80 passages per save; page text is capped at 8,400 characters, passages at 1,400 with 200-character overlap. Answer context is limited to 12 passages / 14,000 characters. The API has additional per-user rate limits. These bound work, not a monetary quote. Model calls use timeouts and bounded retries.

Jobs have leases, bounded attempts, idempotent fingerprints and conditional commits, so restarts cannot publish a stale worker result. Enqueue failures preserve the original save and log a content-free warning; such a save remains visibly unindexed and can be retried or selected in an approved backfill. Queue creation is not an atomic transactional outbox with message creation.

An owner may retry an individual save. Older saves are processed only in explicitly confirmed batches of at most 20. The UI first requests a dry run with counts and maximum passages, then asks the user to approve possible OpenAI charges. There is no automatic production-wide backfill.

## Extraction-provider boundary

Readable public HTML/text works without adding a paid scraper. Firecrawl was available in the integration catalog but was not connected or enabled for this change. JavaScript-only, login-required and anti-bot pages can remain unsupported/blocked. A rendered-page provider would need separate approval and bounded integration; it would not guarantee access to Instagram, TikTok or Reddit posts.

## Schema and rollout

This adds only knowledge settings, sources/jobs, chunks and usage tables to the existing database. Development schema was applied with `npm run db:push`; no production schema or production content was changed. Do not put DDL into application startup or deployment build commands. Review and approve the additive production schema through Replit's publish migration flow before publishing. The existing post-merge hook uses the committed lockfile, typechecks and builds; it deliberately does not approve database changes.

## Verification

- `npm run test:knowledge`: pure extraction, bounds, query and citation tests; DB tests explicitly skip.
- `npm run test:knowledge:db`: development-only temporary users/boards/messages with mocked OpenAI, page fetches and S3. **Stop the main app worker first**; never use a production connection. Fixtures are removed after each test.
- `npm run test:knowledge:browser`: mobile Chromium against the existing app on port 5000, with test-only API/auth interception. Does not weaken application authentication or start another server. Uses Replit's wrapped Chromium when present; otherwise run Playwright's browser install on a compatible host.
- `npm run test:previews`, `npm run check`, `npm run build`: existing compatibility/type/build checks.

These automated checks do not validate a live OpenAI key, provider billing, public-source availability or real OCR accuracy. A small approved provider smoke test is required before claiming those boundaries were verified.

A live direct-fetch check of `https://example.com` on 2026-10-06 produced a ready source with 156 characters. This verifies the real public HTTP/readability path, not any specific recipe, social platform, authenticated session, or OpenAI operation.

`npx tsx scripts/knowledge-smoke.ts --approve-openai-charges` runs a live check using only a hardcoded synthetic recipe and generated image, with a six-request network cap (including retries). Run only after explicit approval for normal OpenAI charges. It does not read saved content, create database fixtures, or upload to S3.
