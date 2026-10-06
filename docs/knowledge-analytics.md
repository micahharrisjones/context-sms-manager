# Knowledge search analytics

These events measure successful browser actions only, not SMS/MMS activity. They use the existing optional Replit analytics wrapper; Pendo is unchanged.

| Description | Event name | Properties |
| --- | --- | --- |
| Latest submitted search response accepted by the mounted UI | `knowledge_search_completed` | `answer_status`: ready, insufficient, unavailable, disabled; `search_method`: hybrid, keyword; `result_count` and `citation_count`: integers capped at 100 |
| User activates a citation pointing to a displayed save | `knowledge_cited_source_inspected` | `source_kind`: note, page, photo, preview |
| User explicitly confirms an older-save batch and the server accepts queueing | `knowledge_older_saves_queued` | `queued_count`: integer capped at 20 |

Unexpected category values become `unknown`. Counts are floored and clamped to zero and the stated cap; non-finite counts become zero. Values at a cap mean “at least this many,” not an exact larger count.

Search completion means a successful HTTP response was accepted, **not** necessarily that AI produced an answer or the user found the desired save. Use `answer_status`, result counts, and source inspections to understand outcomes. Unavailable/disabled answers can still have successful keyword results. Queueing is not evidence that background processing finished; a successful empty batch reports zero.

No queries, excerpts, source titles, URLs, tags, board names/IDs, user identifiers, photos, signed media URLs, warnings or provider errors are sent in these custom payloads. No keystrokes, estimates, review/cancel clicks or failed requests are counted. Canceled, superseded and unmounted responses do not emit success events. Each accepted search emits once at response acceptance, never in render/effects. Each citation emits only on its first activation within that accepted response; a new successful search resets that guard. Events do not contain per-user or per-search correlation identifiers, so aggregate ratios are not exact linked funnels.

The optional tracker is supplied by Replit's publishing proxy. **Go to Publishing settings, enable analytics, and publish or republish your app. The analytics changes will take effect on the next publish.** Do not add analytics scripts, website IDs, credentials or environment variables. Development and analytics-disabled deployments safely do nothing; synchronous exceptions and rejected tracker promises cannot break the UI. Replit analytics applies to the published website, including mobile browsers, not native mobile apps. Browser tests use a test-only in-memory tracker, not a real analytics service.

Privacy scope here covers custom payloads. Automatic pageview/URL collection and existing Pendo behavior are separate: avoid sensitive query strings in published links and review those providers' collection settings independently.

Checks: `npm run test:knowledge` covers payload bounds and failure isolation; `npm run test:knowledge:browser` covers mounted mobile interactions, failures, cancellation (including a transport that ignores abort), navigation, batch locking and deduplication.

After data starts arriving:
- How often do searches return a ready answer versus keyword-only or insufficient outcomes?
- Which source kinds are inspected most often after search?
- How many older-save batches are successfully queued, and how large are they?
