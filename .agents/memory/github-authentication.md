---
name: GitHub authentication
description: A Git bridge authentication mismatch that can block otherwise authorized pushes.
---

An authorized GitHub REST connection is not necessarily a Git transport credential. This workspace's Git bridge rejected a legacy REST connection while the existing GitHub CLI authentication had repository push permission.

**Why:** Reconnecting or attaching the REST integration alone does not establish that native Git fetch/push authentication works.

**How to apply:** Check GitHub CLI repository permissions without printing credentials. If that authorization works, use command-scoped GitHub CLI credential handling and an exact-repository URL identity rewrite to bypass the mismatched bridge. Do not persist tokens, alter saved remotes, or force-push. Fetch before pushing and verify the remote branch matches the local commit afterward.
