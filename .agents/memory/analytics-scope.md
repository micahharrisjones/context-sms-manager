---
name: Custom analytics scope
description: Scope and privacy decisions for Replit custom-event instrumentation.
---
Replit custom analytics measures successful browser actions, not incoming SMS/MMS activity. Keep existing Pendo instrumentation intact.

**Why:** The injected Replit tracker runs in published browsers, while inbound messages are processed on the server; conflating them would misrepresent usage.

**How to apply:** Label web message events accordingly. Use categorical properties only; do not add board names, message text, phone numbers, or verification codes. Track completed actions after API success, not button clicks that might fail.

Knowledge analytics may include bounded aggregate counts alongside fixed categories, but must never include saved content, queries, source metadata/URLs, tags, board names, identifiers, media or provider errors.

**Why:** The product goal is to measure whether search helps people find their saves without collecting the private material they saved. A completed request is not proof that an answer was useful; accepted queueing is not proof that processing finished.

**How to apply:** Keep success/outcome language precise and distinguish search completion, cited-source inspection and batch queueing. Do not add correlation identifiers or free-form properties to make exact funnels possible.
