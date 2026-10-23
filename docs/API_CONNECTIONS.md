# Aside API and infrastructure inventory

This is a source-code inventory, **not proof that credentials are present,
accounts are owned by the operator, or live provider calls work**. Confirm those
privately with the owner. No secret values have been exported.

## Runtime integrations

| Service | Current purpose / implementation | Configuration names | Migration action |
| --- | --- | --- | --- |
| PostgreSQL / Neon-compatible connection | Users, saves, boards, sharing, authentication records, extracted text, vectors, indexing jobs, scan reports, short links. `server/db.ts`, `shared/schema.ts`, `server/storage.ts`. | `DATABASE_URL` | Identify the actual **production** database and owner. Keep an already owner-controlled compatible database if appropriate; otherwise restore a complete backup into a compatible target. Current application driver uses Neon WebSockets, not a generic TCP `pg` pool. |
| OpenAI | Saved-content extraction/interpretation, 1536-dimensional embeddings, retrieval answers, SMS intent handling. `server/knowledge/provider.ts`, `server/ai-service.ts`, `server/aside-ai-service.ts`. | `NEW_OPENAI_API_KEY`, fallback `OPENAI_API_KEY` | Keep the provider/model contract and account. Configure a scoped key securely; preserve vectors, photo opt-in and limits. No automatic switch to Anthropic. |
| Twilio | Phone login/verification and inbound/outbound SMS/MMS. `server/twilio-service.ts`, `server/routes.ts`, `server/hey-aside-webhook.ts`. | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Confirm account/number ownership and billing. Record number/messaging-service webhook configuration, HTTP method, callbacks and fallbacks privately. Existing primary incoming route is `/api/webhook/twilio`; audit actual registered callback routes rather than inventing aliases. |
| AWS S3 | Image uploads and signed image reads; image evidence for indexing. `server/s3-service.ts`, `server/knowledge/ingestion.ts`. | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, optional `S3_ASSET_BASE_URL` | Retain bucket, object keys, region and media references. Check IAM, encryption/KMS permissions if applicable, CORS, retention and any CDN domain. The existing upload client explicitly passes access keys; role-based auth needs a reviewed code change. |
| Microlink | Public link metadata; paid endpoint when a key is configured. `server/og-service.ts`. | `MICROLINK_API_KEY` | Keep existing account/plan and request settings; verify previews and any egress/IP restrictions on the new host. |
| TMDB | Movie metadata/posters, including IMDb-related previews. `server/tmdb-service.ts`. | `TMDB_API_KEY` | Keep key and attribution requirements. Test actual saved movie URLs and fallback images, not just a provider health check. |
| Pendo | Browser analytics plus server/SMS event and visitor metadata. `client/src/lib/pendo.ts`, `server/pendo-service.ts`. | Server: `PENDO_TRACK_SECRET_KEY`; inspect existing browser configuration separately. | Keep the existing project if approved; keep development telemetry isolated. Private server credentials must never be moved into frontend variables. Preserve existing privacy-safe event contracts. |
| Squarespace | Optional website signup route, CORS and signed/shared-secret integration. `server/index.ts`, `server/routes.ts`. | `SQUARESPACE_DOMAIN`, `SQUARESPACE_WEBHOOK_SECRET` | Confirm whether still active. Preserve exact allowed origin and `/api/signup` contract; do not replace CORS with `*` or disable verification to make staging work. |

## Platform-specific and supporting dependencies

| Dependency | What does and does not transfer |
| --- | --- |
| Replit deployment | Does not become hosting merely by cloning GitHub. Replace process supervision, TLS, logs, restart policy, health monitoring and runtime configuration on the new host. |
| Replit secret storage | Secret **names** are documented; values do not follow Git. Owner transfers required values directly to a trusted secret manager. Do not export a plaintext inventory into the repo or an AI conversation. |
| Replit GitHub connections | Development/source-control authorization, not an app API requirement. Configure native GitHub access for the local Claude Code workflow. Replit connector tokens are not portable GitHub/provider credentials. |
| Replit custom analytics | `client/src/lib/analytics.ts` calls optional `window.umami`; the publishing proxy supplies its tracker. On another host these events will silently be absent unless an approved analytics implementation supplies compatible tracking or the wrapper is deliberately adapted. Preserve no-content payloads and avoid duplicate tracking. |
| Replit Vite tooling | `vite.config.ts` includes Replit plugins; cartographer is conditional on `REPL_ID`. Audit external development/build behavior. Do not blindly delete the theme plugin: it contributes app styling and is also used by browser fixtures. |
| Replit domain assumptions | Short-link validation references `REPLIT_DOMAINS`; other production links use `textaside.app`. Audit generated links, domain allowlists, proxy headers, service worker and canonical webhook URLs. Do not broaden redirect allowlists to support an arbitrary staging host. |
| Public social embeds / HTML fetching | Reddit/TikTok/Instagram and other sites can block embeds or scraping. Preserve attribution, URL safety and fallbacks. A hosting move does not remove login walls, paywalls or provider restrictions. User social-account sign-in is not part of this migration. |

## Secrets and retained data

- `SESSION_SECRET` signs sessions; preserving it alone does not migrate the
  current in-memory session store. Plan for a sign-in after cutover.
- `ENCRYPTION_KEY` protects existing encrypted user data. Determine and preserve
  the **effective old key** privately. The source contains development fallbacks;
  merely seeing a missing environment variable does not establish that the
  stored data is unencrypted. Do not deploy with fallbacks or casually rotate
  this key.
- Inventory provider accounts, key scopes, billing, quotas, expiry, IP rules,
  allowed origins and webhook destinations in a private operator record.
- Treat database backups, screenshots containing real saves, logs with phone
  numbers and provider responses as private data.
- Check for configuration outside environment variables as well: provider
  consoles, DNS, the database, frontend public identifiers and AWS policies.
- `NEON_DATABASE_URL`, `MIXPANEL_TOKEN`, `PENDO_INTEGRATION_KEY` or `GIT_URL`
  appearing in an old secret list does not prove current runtime use.
  Source currently reads `DATABASE_URL` for the database and
  `PENDO_TRACK_SECRET_KEY` for server-side Pendo. Confirm any additional consumer
  before copying, deleting or rotating old secrets.

## Acceptance checks

Use a dedicated test sender/number, isolated database and media, and approved
provider budgets. Check:

1. SMS login/verification, invalid/expired codes and session behavior.
2. Signed inbound SMS, hashtag saves, MMS storage and outgoing replies.
3. “Hey Aside” retrieval with up to five newest matching saves, titles and
   **original saved URLs**, plus the count of matches.
4. Private/shared-board isolation, membership revocation and existing names.
5. S3-backed old/new images and expiring signed URL renewal.
6. Representative **actual saved links** across movie, article and social
   providers, including blocked/error fallbacks.
7. Keyword search without AI, semantic/cited search with consent, photo opt-in,
   daily limits and the old-save scan's real progress/completion counts.
8. Pendo/custom analytics behavior without leaking save text, questions, URLs
   or phone numbers into newly added custom event payloads.
9. Squarespace signup if active, plus HTTP/WebSocket behavior through HTTPS.

Automated mocks verify contracts, not ownership, billing, carrier delivery,
provider authorization, live extraction quality or iPhone Safari behavior.
