---
name: AI product scope
description: User-selected purpose of Aside's AI rework and boundaries on adjacent features.
---
## Search-upgrade introduction

After login, introduce rebuilt AI search and offer an explicit scan of the user's older saved cards. Deferring the introduction is for that login session; acknowledging a completed scan should keep it from reappearing. Progress and indexed/not-indexed counts with reasons belong in this popup, not on individual save cards.

**Why:** On 2026-10-07 the user requested an optional post-login introduction, scanning all older saves, real progress, and a completion summary with choices to search now or later.

**How to apply:** Preserve account ownership boundaries and existing photo opt-in. Scan the whole older-card cohort rather than stopping at one batch; report failures and usage limits honestly.

Aside's AI rework should build a growing, user-queryable RAG knowledge base from saves, rather than merely summarize search results or automatically organize boards. It includes retrieving actual link content and extracting useful evidence from photos at save time.

**Why:** On 2026-10-06 the user selected “Search and answers,” then clarified that links, photos, and information should form a growing RAG database with enough ingested content to answer useful questions. The user also set aside connecting users' social-platform accounts for now.

**How to apply:** Treat link-content retrieval and photo analysis as evidence acquisition for search and answers, not as unrelated AI features. Preserve source evidence rather than replacing it with summaries. Automatic organization, social-account logins, and audio/video understanding still need separate agreement.

The user confirmed “Hey Aside” SMS recall should return up to five newest matching saves, each with a readable title and the original saved URL directly below it. They also want the total number of matching saves, not just the number displayed.

**Why:** On 2026-10-06 the user approved connecting SMS to the knowledge base, then explicitly specified the five latest results and direct original links using a pasta-recipe example.

**How to apply:** Reuse authorized source retrieval, order eligible results by saved date rather than relevance alone, and never substitute a dashboard/login link for the requested original URL. Keep help and login commands intact. Do not label capped or incomplete counts as exhaustive.

Aside's default search surface should emphasize finding saved items rather than scope/date configuration, an answer-summary card or indexing-management/coverage sections. Photo inclusion remains an explicit opt-in.

**Why:** On 2026-10-06 the user requested these specific removals to simplify search, while keeping “Include photos” and a brief notice about unreadable private/paywalled/blocked pages. This was a presentation change, not permission to reset privacy choices or stop ingestion.

**How to apply:** Do not reintroduce these sections by default without new agreement. Preserve existing analysis consent when updating photo preferences, and retain backend indexing/backfill capabilities even when their search-page controls are hidden. The user further requested photo inclusion be part of the search controls rather than a standalone card; this visual integration does not authorize changing it from a processing opt-in to a results-only filter.

Keep saved-item cards focused on the saved content, without a library-coverage disclosure, indexing status, source-extract panel or per-card analysis retry control.

**Why:** On 2026-10-07 the user requested removal of the entire card-level coverage section as unnecessary, not only the search page's global coverage section.

**How to apply:** Apply this to cards wherever they appear, including feeds, boards and search results. Preserve backend indexing and existing evidence; removing the diagnostic UI does not disable analysis.
