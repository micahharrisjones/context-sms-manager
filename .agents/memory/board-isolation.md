---
name: Board isolation scope
description: Privacy fixes must not silently change the existing hashtag-based board naming model.
---
Do not globally rename or deduplicate boards as part of a security repair. Preserve the hashtag-based user experience while restricting reads and notification recipients to authorized board IDs.

**Why:** Making all names globally unique or migrating messages to a new board-association model would change existing user behavior and requires separate product agreement. A security fix should not silently make that decision.

**How to apply:** Treat names as navigation labels, not authorization identifiers. When name-based navigation is ambiguous for a user, fail closed rather than combine board memberships. A future move to board-ID navigation should be explicit and preserve existing links or provide a migration plan.
