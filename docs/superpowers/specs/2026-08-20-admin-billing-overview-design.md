# Admin panel: billing overview dashboard

**Date:** 2026-08-20
**Status:** Approved, pending implementation plan

## Problem

`public/admin-users.html` ("User Control") shows per-user billing (subscriptions,
payments, total paid, payment-issue alerts) on each user's detail page, but there's
no aggregate view of the business's billing health across *all* users. An admin has
to open users one at a time to piece together how revenue is trending, and there's
no single place to answer "how much are we making, and is it growing?"

## Goals

- Add a "Facturación" dashboard section to the list page (the page an admin lands
  on) showing real, aggregate billing data across all users: total revenue, current
  MRR, this month's revenue, and payment issues needing attention.
- Visualize the revenue trend over time (line/bar chart), switchable between a
  monthly view and a yearly view.
- Show plan distribution (how many active users are on each tier) as a donut chart.
- Keep it professional-looking and consistent with the app's existing dark-glass
  visual language and with the Chart.js patterns already used in `app.html`'s
  finances section (`public/js/finances-charts.js`).
- Don't slow down the page's primary job (loading the user list/table).

## Non-goals (out of scope for this pass)

- Editing/refunding payments from this dashboard (Stripe Dashboard link already
  exists per-user for that).
- Exporting billing data (CSV, PDF reports).
- Forecasting/projections — only historical + current-state numbers.
- A true lifetime-value figure with unlimited history — bounded by the same
  `limit(5000)` safety cap used elsewhere in this codebase for admin aggregation
  queries (see `adminGetUserDetail`'s `loads` query). For this app's current scale,
  5000 payment records across all users is expected to comfortably cover all
  historical data; if that assumption stops holding, revisit then.

## Approved layout (Option B from visual review)

A dedicated "💳 Facturación" section, inserted between the existing `.stats` row
(user counts by plan/status — unchanged) and the toolbar/table. Structure:

1. Header row: "💳 Facturación" title + a Mes/Año toggle (pill-style, matching the
   existing toggle visual language in the app).
2. Four stat cards (reusing the existing `.stat`/`.stats` CSS classes already
   defined in `admin-users.html`): **Ingresos totales**, **MRR actual**, **Este
   mes**, **Pagos con problema**.
3. Two-column row below the stat cards: a wider revenue-trend chart (line, Chart.js)
   on the left, a smaller plan-distribution donut on the right.

The section loads asynchronously after the table's own data, with a lightweight
loading state, and degrades to a hidden/collapsed state (not a broken/error-looking
block) if the backend call fails.

## Data flow

### New Cloud Function: `adminGetBillingOverview`

- `onCall`, region `us-central1`, gated by the existing `_requireAdmin` helper —
  same pattern as `adminGetUsers`/`adminGetUserDetail`/`adminUpdateUser`.
- Fetches, in parallel:
  - `db.collectionGroup('payments').limit(5000).get()` — every payment record
    across every user's `customers/{uid}/payments` subcollection (the Admin SDK
    bypasses Firestore security rules, so this is a legitimate cross-user read for
    an admin-only function, same trust boundary as the existing per-user billing
    fetch).
  - `db.collectionGroup('subscriptions').limit(2000).get()` — every subscription
    record across every user's `customers/{uid}/subscriptions` subcollection.
- No `orderBy`/`where` on either query — avoids requiring a new Firestore composite
  index, matching the established pattern from `adminGetUserDetail`'s `loads`
  query. All grouping/aggregation happens in memory after the fetch.
- Reuses the same pay-field reading already established for per-user payments
  (`amount` in cents, `status`, `created` as a Unix timestamp or Firestore
  Timestamp) — no new field-name fallback chain needed, this data always comes
  from the Stripe Firestore extension's own consistent schema (unlike the legacy
  `loads` collection).

**Computed and returned:**

```js
{
  totalRevenue: number,        // sum of amount/100 for every payment with status === 'succeeded'
  mrr: number,                 // sum of unit_amount/100 (from subscription.items.data[0].price.unit_amount)
                                // for every subscription with status === 'active'
  thisMonthRevenue: number,    // sum of succeeded payments whose created date falls in the current calendar month
  failedPaymentsCount: number, // count of payments with status !== 'succeeded'
  revenueByMonth: [ { month: 'YYYY-MM', total: number }, ... ],  // last 12 months, oldest first, zero-filled for months with no revenue
  revenueByYear: [ { year: 'YYYY', total: number }, ... ],       // all years present in the data, oldest first
}
```

`mrr` is computed from the *actual current Stripe price* on each active
subscription record, not a hardcoded plan→price table — this avoids a second,
easily-stale source of truth for pricing (the codebase already has one such table,
`PRICE_TO_PLAN` in `functions/index.js`, used only for webhook plan-activation
routing, not for display; this feature doesn't touch or duplicate it).

The existing frontend code (`renderDetailPage`'s subscription rendering) already
reads a subscription's price two different ways —
`s.price?.id || s.items?.data?.[0]?.price?.id` — because it's not fully certain
which shape this Firestore extension version mirrors. The MRR calculation must use
the same dual-path tolerance for the price amount:
`sub.price?.unit_amount ?? sub.items?.data?.[0]?.price?.unit_amount ?? 0`, summed
across every subscription with `status === 'active'`.

### Plan distribution (donut)

Computed entirely client-side from `ALL_USERS` — the array the list page already
fetches via `adminGetUsers` and holds in memory for the table/stats row. No new
data, no additional backend call. Counts active (non-suspended) users per `plan`
value, same four buckets already used by the existing `.stats` row (`free`,
`starter`, `professional`, `premium`).

### Frontend rendering

- `public/admin-users.html`: new `renderBillingOverview()` function, called once
  on initial list-view load (in parallel with `refreshUsers()`, not blocking it),
  and re-called if the admin manually refreshes the list. Fetches
  `adminGetBillingOverview` via the existing `cf()` mock-aware calling convention
  (so `?mock=1` continues to work for manual testing, matching every other call in
  this file).
- Chart.js is loaded via the same CDN `<script>` tag pattern already used in
  `app.html` (`https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js`) —
  same version, so behavior is already proven in this codebase.
- Revenue trend chart: single-line Chart.js line chart (styled with the app's
  purple accent, matching `--purple: #8b5cf6`), labeled with formatted month/year
  labels, y-axis formatted as currency — visually consistent with
  `updateCashFlowChart()` in `public/js/finances-charts.js` (same library, same
  dollar-formatting callback pattern), but a single revenue series instead of
  three (no expenses/profit concept at the admin/business level for this view).
  The Mes/Año toggle swaps `chart.data` between `revenueByMonth` and
  `revenueByYear` client-side — no re-fetch, since both aggregations are already
  in the response.
- Plan distribution: Chart.js doughnut chart, four segments (free/starter/
  professional/premium), colors matching the existing pill colors already defined
  for those plans in `admin-users.html`'s CSS (`.pill-free`, `.pill-starter`, etc.)
  for visual consistency between the table's pills and the chart's legend.
- All numeric fields render through the existing `fmtMoney()` helper (already
  XSS-safe via `Number()` coercion) — no new escaping concerns, since every value
  in this feature is server-computed from Stripe data, not free-text user input.

## Error handling

If `adminGetBillingOverview` throws (network error, permissions edge case,
malformed data), `renderBillingOverview()` catches it and hides the whole
Facturación section (removes/skips rendering it) rather than showing a broken
partial UI or an intrusive error banner — the user list and its own stats remain
fully usable regardless. A `console.warn` is logged for debugging, matching the
quiet-failure style already used by `_getUserBilling` in `functions/index.js`.

## Testing

- Extend `functions/test-admin.js` with payment fixtures across at least 3
  different users, spanning at least 2 different months and 2 different years
  (including at least one non-`succeeded` payment, and at least one active
  subscription with a known `unit_amount`), and assert the exact computed
  `totalRevenue`, `mrr`, `thisMonthRevenue`, `failedPaymentsCount`, and the shape/
  values of `revenueByMonth`/`revenueByYear`.
- Sync the same fixtures into `scripts/admin-mock-server.js` so the dashboard
  renders real, non-empty charts during manual `?mock=1` testing (same
  reason/pattern as the fixture-sync step from the prior admin-detail-page plan).
- Manual verification via the mock server: confirm both charts render, the Mes/Año
  toggle swaps the trend chart without a network request (visually — or checked
  via a quick Playwright pass, matching how prior admin-panel work was verified),
  and that killing the mock endpoint (or a deliberately-broken response) results in
  the section disappearing cleanly rather than an error state.
- Real-account smoke test on production after deploy, same as prior admin-panel
  work in this project.
