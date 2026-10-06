---
name: Preview integration verification
description: Avoid incorrect provider-availability and social-embed policy claims during preview audits.
---
Do not conclude a preview provider is unconfigured solely because the managed secret inventory lists its key as absent. Check runtime behavior without exposing credentials.

**Why:** During an audit, the managed inventory reported Microlink and TMDB keys absent, but the running app returned metadata and a TMDB movie poster. The credential source was not established.

**How to apply:** Report inventory and operational evidence separately. A successful app preview does not prove which upstream produced it. Likewise, comments and earlier chat claims that social platforms block all scrapers are not evidence of current provider policy; verify those claims before using them to justify bypassing providers.

Preserve usable legacy previews when introducing source attribution. Do not require a new metadata field on every historical record without a compatibility strategy.

**Why:** Rejecting all pre-attribution records caused a production preview regression and forced large feeds to refetch historical thumbnails through a rate-limited endpoint.

**How to apply:** A historical record with exactly one distinct link can retain its saved preview. Multiple-link records require explicit attribution. Keep clearing metadata on edits; a known source mismatch must never use the legacy exception. Verify legacy cards, not just newly enriched fixtures.

Treat a working movie-provider test as evidence for that title only, not complete IMDb coverage.

**Why:** The live provider could return a well-known movie poster while another posted IMDb ID had no catalogue match. Its direct page also returned an empty HTTP 202 response, not usable metadata.

**How to apply:** Test the user's actual link and production responses. Keep independent page-metadata and saved-image fallbacks available; never manufacture a poster or say an unavailable title is fixed solely because a different title works.
