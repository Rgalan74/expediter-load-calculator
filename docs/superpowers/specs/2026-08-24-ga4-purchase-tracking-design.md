# Fix: GA4 `purchase` event lost on checkout return

**Date:** 2026-08-24
**Status:** Approved, pending implementation plan

## Problem

Confirmed via code review (this session, cross-checked against a second
independent review) in `public/js/stripe-config.js`'s
`handleCheckoutResult()`:

1. `public/js/analytics-manager.js:211` creates `window.analyticsManager`
   **unconditionally** the moment the script loads (`app.html:2657`,
   a static `<script src>` tag, not gated by cookie consent at all).
2. `handleCheckoutResult()` (`stripe-config.js:355-356`) checks only
   `if (window.analyticsManager)` — true essentially always on
   `app.html` — and calls `analyticsManager.trackEvent('purchase', ...)`.
3. `trackEvent()` (`analytics-manager.js:96`) only forwards to `gtag()`
   if `this.initialized === true`; otherwise it pushes to
   `this.eventsQueue` (in-memory array) and returns.
4. `this.initialized` only becomes `true` once `init()` runs, which is
   gated behind a `setTimeout(..., 500)` (`analytics-manager.js:254`)
   plus, on `app.html`, its own separate `firebase.auth().onAuthStateChanged`
   listener. `handleCheckoutResult()` registers **its own**,
   **earlier**-registered `onAuthStateChanged` listener
   (`stripe-config.js:333`) — Firebase calls listeners in registration
   order, so the purchase-tracking code very likely runs before
   `analyticsManager` finishes initializing.
5. Immediately after (no `await`, no delay, for a normal — non-portal —
   purchase return), `stripe-config.js:389` calls
   `window.location.reload()`, wiping `eventsQueue` before it's ever
   flushed.

Net effect: the `purchase` event is a confirmed race condition, high
probability of being lost, and applies regardless of cookie consent
state (correction from an earlier, narrower diagnosis this session —
`window.analyticsManager` exists on `app.html` no matter what the user
chose in the cookie banner).

A second, independent bug: `purchaseParams.value` depends entirely on
`sessionStorage.getItem('pendingCheckoutPlan')` (`stripe-config.js:344`).
If that's missing (tab closed and reopened mid-checkout, storage
cleared, etc.) the event still fires but with `value: 0` and no
`items` — silently wrong revenue data.

## Goals

- `purchase` reaches `gtag()` directly — never depend on
  `analyticsManager`'s in-memory queue for this specific,
  revenue-critical event.
- The event has a real chance to leave the browser before
  `window.location.reload()` destroys the page context.
- If `sessionStorage.pendingCheckoutPlan` is missing, fall back to a
  real source of truth (`getUserPlan(user.uid)`, which queries the
  live Stripe subscription — already used elsewhere in this same file)
  instead of silently sending `value: 0`.
- `transaction_id: sessionId` stays exactly as-is (already correct,
  already used for both GA4 and Meta deduplication).
- The purchase-params construction becomes a pure, unit-testable
  function, decoupled from `window`/`sessionStorage`/`firebase` so it
  can be tested the same lightweight way this repo already tests
  Cloud Functions (`functions/test-*.js`) — plain `node` execution, no
  emulator.
- A Playwright test simulates the `?session_id=...` return and proves
  `gtag('event', 'purchase', ...)` fires **before** the reload is
  attempted — the actual failure mode this bug produces.

## Non-goals (explicitly out of scope for this pass)

- `begin_checkout` — already fires reliably (raw `gtag()` call, several
  real seconds before navigating away to Stripe; not touched unless a
  test proves otherwise, and none of the investigation this session
  found evidence it's broken).
- Meta Pixel `Purchase` / Conversions API — separate code path
  (`trackMeta`/`fbq` called directly, not through `analyticsManager`),
  not subject to this bug, not touched.
- GA4 / Google Ads dashboard configuration (event linking, "key event"
  marking, conversion import) — already handled outside this repo;
  this fix is entirely about the app reliably *sending* the event, not
  about how GA4/Ads consume it.
- Stripe backend logic (`functions/index.js`, webhooks, checkout
  session creation) — untouched.
- A server-side GA4 backup for `purchase` (GA4 has no equivalent to
  Meta's Conversions API used here for `Purchase`) — flagged as a
  genuinely valuable future improvement, but a separate, larger piece
  of work (would need GA4 Measurement Protocol calls from
  `functions/index.js`'s Stripe webhook handler). Not part of this fix.

## Architecture

### New file: `public/js/purchase-tracking.js`

A pure function, `buildPurchaseParams(sessionId, purchasedPlanId, plansMap)`,
extracted from the inline logic currently in `handleCheckoutResult()`.
No DOM, no `sessionStorage`, no `firebase` — just data in, data out, so
it can run identically in Node (for a unit test) and in the browser.
Returns `{ transaction_id, currency, value, items, _planFound }` — the
extra `_planFound` boolean is what `handleCheckoutResult()` uses to
decide whether the sessionStorage-derived plan was usable or whether
to fall back to `getUserPlan()`.

Exports via the same dual pattern already informally used for
testability in this session's Cloud Function tests: `module.exports`
when running under Node, `window.buildPurchaseParams` in the browser.

### `handleCheckoutResult()` changes (`stripe-config.js`)

Replace the current block (lines ~344-359) with:

1. Call `buildPurchaseParams(sessionId, sessionStorage.getItem('pendingCheckoutPlan'), window.PLANS)`.
2. If `!result._planFound`, call `window.getUserPlan(user.uid)` (already
   imported/available on this page, already used a few lines below in
   the existing portal-detection block) and rebuild
   `buildPurchaseParams(sessionId, planFromServer.id, window.PLANS)`.
3. Send directly: `if (typeof gtag === 'function') gtag('event', 'purchase', purchaseParams);` —
   no `analyticsManager` in this path at all. `gtag.js`'s own
   transport already uses `navigator.sendBeacon` for exactly this
   "about to unload" scenario, so once the direct `gtag()` call
   happens, delivery no longer depends on anything in this codebase.
4. Testability seam: `handleCheckoutResult()`'s single
   `window.location.reload()` call at the very end (the one that runs
   right after purchase tracking, `stripe-config.js:389`) gets
   replaced with `window.__reloadPage()`, where
   `window.__reloadPage = window.__reloadPage || (() => window.location.reload());`
   is defined once near the top of the file. In production this is
   functionally identical to calling `location.reload()` directly — it
   only exists so a test harness can pre-define `window.__reloadPage`
   as a spy *before* this script loads, without fighting the browser's
   (sometimes non-overridable) `Location` object. Scoped to only this
   one call site — the other `window.location.reload()` calls in the
   file (portal-return flow, auth-not-ready retry) are untouched, out
   of scope.

### Tests

- `public/.test/test-purchase-tracking.js` — plain Node script (no
  Firebase/browser mocking needed at all, since the function under
  test is pure), run via `node public/.test/test-purchase-tracking.js`,
  same pass/fail console-summary style as `functions/test-*.js`.
- `public/.test/purchase-flow-harness.html` — a minimal standalone
  page (not part of the real app, never linked from anywhere) that
  stubs `firebase`, `gtag`, `window.PLANS`, and pre-defines
  `window.__reloadPage` as a spy, then loads the real
  `purchase-tracking.js` + `stripe-config.js` and calls
  `handleCheckoutResult()` directly against a simulated
  `?session_id=...` URL. A Playwright script drives this harness and
  asserts the `gtag` spy was called with `event: 'purchase'`
  **before** the `__reloadPage` spy was called.
- Both files live under `public/.test/` — the leading dot makes the
  folder match the existing `"**/.*"` entry in `firebase.json`'s
  hosting `ignore` list, so neither ever gets deployed. No
  `firebase.json` change needed.

## Success criteria

- `node public/.test/test-purchase-tracking.js` passes, covering: plan
  found in `plansMap` → correct value/items; plan not found → `value: 0`
  and `_planFound: false` (so the caller knows to fall back);
  `transaction_id` always equals the `sessionId` passed in.
- The Playwright harness test passes, proving the call-order
  invariant: `gtag('event','purchase',...)` is observed **before**
  `__reloadPage()` is observed, using the exact same code path as
  production (`purchase-tracking.js` + `stripe-config.js`, not a
  reimplementation).
- Manual smoke test against a real Stripe **test-mode** checkout
  (recommended before/alongside deploy, using Stripe's test card
  `4242 4242 4242 4242`) confirms the event appears in GA4 DebugView
  in real time.
- `begin_checkout`, Meta Pixel/CAPI, and the Stripe backend are
  byte-for-byte unchanged — verified by `git diff` scope, not just by
  intent.
