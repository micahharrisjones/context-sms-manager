---
name: Custom analytics scope
description: Scope and privacy decisions for Replit custom-event instrumentation.
---
Replit custom analytics measures successful browser actions, not incoming SMS/MMS activity. Keep existing Pendo instrumentation intact.

**Why:** The injected Replit tracker runs in published browsers, while inbound messages are processed on the server; conflating them would misrepresent usage.

**How to apply:** Label web message events accordingly. Use categorical properties only; do not add board names, message text, phone numbers, or verification codes. Track completed actions after API success, not button clicks that might fail.
