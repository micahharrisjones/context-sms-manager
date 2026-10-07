# Saved-link recall by SMS

“Hey Aside, what was that recipe I saved with pasta?” uses the existing intent classifier and the knowledge-base retrieval pipeline. Saved-content search, summary and recommendation intents now return short source-backed link lists; help/login commands remain available. Topic-specific counts use retrieval rather than global library statistics.

## Reply

- Count distinct matching saved items with an original HTTP(S) URL; return at most five, ordered by saved timestamp descending and ID descending for ties.
- Match indexed page/photo/note passages, compatible vectors, original notes and trustworthy preview metadata. The sender's own library is the scope; SMS does not infer access to another person's board.
- Choose the title and URL from a matching page source belonging to that save, or verified matching preview metadata. Fall back to the user's note or hostname/path if no readable title was acquired. Never invent a recipe title.
- Preserve original query parameters and destinations; no shortened links, magic-login links, signed image URLs or generated destinations are substituted.
- Inspect candidates newest-first in batches of 100, up to 1,000 per request. Counts below the ceiling are exact for retrievable matches; a ceiling is explicitly described as “at least,” not an exact total. One save with multiple matching passages counts once.
- Explain incomplete coverage and keyword-only fallback. Counts are not claims about inaccessible/unprocessed content. Photo-only saves and notes without an original URL cannot appear in a direct-link list.
- Each Twilio body is at most 1,600 characters. Large lists are split at entry boundaries, preserving each original URL intact. An individual URL longer than 1,400 characters gets an explicit unsupported-by-SMS explanation, not a truncated or invented URL.

## Incoming requests and privacy

The existing primary webhook at `/api/webhook/twilio` dispatches these commands before onboarding, ordinary-save processing or raw-payload logging. No additional webhook aliases are registered. Verify Twilio's HMAC-SHA1 signature over the external request URL and all form fields, using the existing Twilio auth token. Missing verification configuration returns 503; invalid signatures return 403 without looking up a user or sending content. Request-derived external protocol/host and original path/query preserve both production and proxy callback URLs.

Only a verified sender maps to their account. A question does not become a save. The webhook acknowledges before background model work to avoid Twilio timeout retries. Duplicate message SIDs are suppressed, and each user is limited to ten commands per minute. Intent classification has a 100/day bound and respects AI preferences/provider availability; retrieval shares the existing knowledge-search budget. Classification outages, unknown intents and opt-outs retain deterministic saved-text search and help/login paths.

Keep the existing Pendo event names but send only intent categories, question length, completed-search flag and part count, never question text, source text, titles or URLs. Analytics failure cannot prevent delivery; failed sends are not reported as sent. SMS delivery logs do not include recipient, response body or raw provider errors.

Background replies and deduplication are currently in process memory, not a durable delivery queue. A restart after acknowledgement can lose a pending answer; the user can resend their question. Successful Twilio submission is not proof of carrier delivery.

## Checks

The knowledge suites include proxy-signature/tampering rejection, acknowledgement before processing, duplicate suppression, source-title/URL attribution, exact and lower-bound counts, newest-five selection beyond the web search's 20-result limit, source-text ingredient matching, stale edits, user isolation, opt-out/outage routing, help/login preservation, empty/oversized questions, burst limits, analytics failure, multipart formatting and send failure. All use synthetic fixtures and mocked providers/transports. An unsigned command to the actual development webhook returned HTTP 403 without processing a question. No real SMS was sent to verify carrier delivery, and the live signed-in SMS flow has not been exercised.
