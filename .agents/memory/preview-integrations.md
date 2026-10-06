---
name: Preview integration verification
description: Avoid incorrect provider-availability and social-embed policy claims during preview audits.
---
Do not conclude a preview provider is unconfigured solely because the managed secret inventory lists its key as absent. Check runtime behavior without exposing credentials.

**Why:** During an audit, the managed inventory reported Microlink and TMDB keys absent, but the running app returned metadata and a TMDB movie poster. The credential source was not established.

**How to apply:** Report inventory and operational evidence separately. A successful app preview does not prove which upstream produced it. Likewise, comments and earlier chat claims that social platforms block all scrapers are not evidence of current provider policy; verify those claims before using them to justify bypassing providers.
