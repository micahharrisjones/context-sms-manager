# Authenticated mobile preview regressions

Run `npm run test:previews` for the existing Vitest server/request/card tests
followed by these Playwright browser checks. Run `npm run test:previews:browser`
to run only browser checks. The existing `preview-regressions` validation
workflow uses the combined command, so browser failures fail validation.

## Browser setup

Playwright uses the system Chromium at `/repl/tools/bin/chromium` on Replit.
Elsewhere, install the matching Chromium with `npx playwright install chromium`,
or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible browser.
The iPhone 13 device profile supplies a 390×844 mobile/touch viewport and user
agent. This is **Chromium emulation**, not a real-device Safari test.

## Isolation and safety

- The standalone fixture server binds only to `127.0.0.1:5017`; Playwright starts
  and stops it. An occupied port fails the run rather than reusing another server.
- Both `NODE_ENV=test` and `PREVIEW_BROWSER_FIXTURES=1` are mandatory. Tests verify
  production refuses startup even with opt-in, and test mode refuses startup
  without opt-in.
- The server is not imported into the normal application or production build.
  It does not import production routes, auth, storage, database, scheduled jobs,
  or preview provider clients.
- Login regenerates an HTTP-only, same-site, in-memory fixture session. Each
  browser context owns its messages. Anonymous API access returns 401 and the
  real frontend protected routes redirect to login.
- Actual App, feed, shared-board, card, and edit-dialog components run unmodified.
  Fixture HTTP endpoints supply auth, profile, board, message, and edit responses.
  They are **not** coverage of real login or production edit persistence; the
  existing request/storage tests cover those server concerns.
- Playwright stubs metadata endpoints, thumbnail images, SDK scripts, and
  third-party iframe documents. Unexpected external/API traffic fails the test.
  There are no paid provider requests or production records.

## Coverage and artifacts

Both feed and shared-board pages cover legacy saved images without attribution,
unattributed/mismatched multi-link previews, edits of the same mounted card,
Instagram fallback link duplication, IMDb catalogue misses/network errors/page
fallbacks/total failure/saved-image survival, and Reddit/TikTok loaded, blank,
and network-failed iframe states.

The browser clock advances the actual eight-second mounted-effect timers.
Reddit and TikTok intentionally use conservative timeout fallbacks even after
an iframe has loaded; an iframe `load` event cannot establish that cross-origin
content is usable. Tests document this behavior rather than assuming load means
permanent success. They do not assert browser-specific iframe `error` events.

Successful runs save screenshots after loading and after fallback timers under
`test-results/preview-browser/`. Each screenshot is attached to the HTML report
in `playwright-report/previews/`; failures also retain Playwright traces.
These are inspectable state captures, not platform-sensitive pixel baselines.
Generated reports and screenshots are ignored by Git.
