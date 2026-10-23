---
name: GitHub authentication
description: A Git bridge authentication mismatch that can block otherwise authorized pushes.
---

An authorized GitHub REST connection is not necessarily a Git transport credential. An API permission check or a successful fetch must not be reported as working push authentication.

**Why:** This workspace's bridge rejected a legacy REST connection. A GitHub CLI API check reported repository push permission and a direct fetch succeeded, but a native Git push still failed authentication.

**How to apply:** Connect GitHub's source-control integration rather than assuming REST authorization suffices. Authorizing this connection restored standard Git fetch/push through Replit's secure proxy without changing saved remotes or credential configuration. Do not print or persist tokens or force-push. Fetch before pushing and verify the remote branch matches the local commit afterward.
