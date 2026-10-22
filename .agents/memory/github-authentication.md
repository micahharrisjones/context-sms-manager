---
name: GitHub authentication
description: A Git bridge authentication mismatch that can block otherwise authorized pushes.
---

An authorized GitHub REST connection is not necessarily a Git transport credential. An API permission check or a successful fetch must not be reported as working push authentication.

**Why:** This workspace's bridge rejected a legacy REST connection. A GitHub CLI API check reported repository push permission and a direct fetch succeeded, but a native Git push still failed authentication.

**How to apply:** Use GitHub's source-control connection for native Git operations rather than assuming REST authorization suffices. Do not print or persist tokens, alter saved remotes, or force-push. Fetch before pushing and verify the remote branch matches the local commit afterward.
