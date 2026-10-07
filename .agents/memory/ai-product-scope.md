---
name: AI product scope
description: User-selected purpose of Aside's AI rework and boundaries on adjacent features.
---
Aside's AI rework should build a growing, user-queryable RAG knowledge base from saves, rather than merely summarize search results or automatically organize boards. It includes retrieving actual link content and extracting useful evidence from photos at save time.

**Why:** On 2026-10-06 the user selected “Search and answers,” then clarified that links, photos, and information should form a growing RAG database with enough ingested content to answer useful questions. The user also set aside connecting users' social-platform accounts for now.

**How to apply:** Treat link-content retrieval and photo analysis as evidence acquisition for search and answers, not as unrelated AI features. Preserve source evidence rather than replacing it with summaries. Automatic organization, social-account logins, and audio/video understanding still need separate agreement.

The user confirmed “Hey Aside” SMS recall should return up to five newest matching saves, each with a readable title and the original saved URL directly below it. They also want the total number of matching saves, not just the number displayed.

**Why:** On 2026-10-06 the user approved connecting SMS to the knowledge base, then explicitly specified the five latest results and direct original links using a pasta-recipe example.

**How to apply:** Reuse authorized source retrieval, order eligible results by saved date rather than relevance alone, and never substitute a dashboard/login link for the requested original URL. Keep help and login commands intact. Do not label capped or incomplete counts as exhaustive.
