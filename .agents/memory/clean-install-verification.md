---
name: Clean-install verification
description: Why dependency reconciliation needs a clean lockfile install before declaring merge setup healthy.
---
Verify dependency changes with a clean lockfile install, not only tests against the existing dependency directory.

**Why:** Previously passing builds and tests hid security-policy blocks on fresh downloads. Post-merge setup exposed several blocked dependencies that normal incremental runs had not exercised.

**How to apply:** Keep the dependency firewall in place. Update blocked dependencies through supported package versions, retain compatible major versions when possible, and verify both the clean install and affected tests. Do not infer an install failure is an authentication problem from HTTP 403 alone; inspect the policy reason first.
