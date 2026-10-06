---
name: Board isolation scope
description: Privacy fixes must not silently change the existing hashtag-based board naming model.
---
Do not globally rename or deduplicate boards as part of a security repair. Preserve the hashtag-based user experience while restricting reads and notification recipients to authorized board IDs.

**Why:** Making all names globally unique or migrating messages to a new board-association model would change existing user behavior and requires separate product agreement. A security fix should not silently make that decision.

**How to apply:** Treat names as navigation labels, not authorization identifiers. When name-based navigation is ambiguous for a user, fail closed rather than combine board memberships. A future move to board-ID navigation should be explicit and preserve existing links or provide a migration plan.

For hashtag-associated shared saves, ambiguity must be checked for both the viewer and the save author, not only the viewer. An author who belongs to multiple boards with the same name cannot identify the intended recipient board through a hashtag alone.

**Why:** Viewer-only ambiguity checks still let a viewer with one matching board read a save that its author may have intended for a different same-named board.

**How to apply:** Fail closed on shared evidence whenever either side has an ambiguous association. Preserve the author's access to their own saves without changing board names or inferring a destination.
