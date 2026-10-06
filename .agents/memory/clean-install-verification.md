---
name: Clean-install verification
description: Why clean lockfile installation and native browser launch need separate verification.
---
Verify dependency changes with a clean lockfile install, not only tests against the existing dependency directory.

**Why:** Previously passing builds and tests hid security-policy blocks on fresh downloads. Post-merge setup exposed several blocked dependencies that normal incremental runs had not exercised.

**How to apply:** Keep the dependency firewall in place. Update blocked dependencies through supported package versions, retain compatible major versions when possible, and verify both the clean install and affected tests. Do not infer an install failure is an authentication problem from HTTP 403 alone; inspect the policy reason first.

Native browser compatibility needs a separate launch check; successful package installation or browser download does not prove a browser can run in this environment.

**Why:** Generic Linux browser binaries can require system libraries absent from a Nix-based environment, even when Node dependencies, typechecks and builds are healthy. This is an environment failure, not evidence that the page is broken.

**How to apply:** Diagnose browser launch errors separately from application/test assertions. Prefer an environment-compatible browser rather than weakening UI tests or changing application code to hide launch failures.
