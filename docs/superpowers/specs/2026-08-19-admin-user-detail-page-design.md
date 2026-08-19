# Admin panel: full-page user detail view

**Date:** 2026-08-19
**Status:** Approved, pending implementation plan

## Problem

`public/admin-users.html` ("User Control") already lists all users with search/filter and
a side-drawer detail view (plan, Stripe subscriptions/payments, admin notes, and actions
to change plan / suspend / cancel subscription). It replaces the older admin panel modal
(`public/js/admin-panel.js`, opened via the "Abrir"/"Open" button in `app.html` →
Configuración), which only shows a flat list of users and their roles.

Two problems to solve:

1. The old "Abrir" button is redundant now that "User Control" is the real admin panel —
   it should stop appearing.
2. The user-detail view needs to show much more than it does today: vehicle/cost/
   preference configuration (for troubleshooting "why are my numbers off"), and real
   usage data (loads, Academy progress) for a full picture of the customer — not just
   billing. The current 560px side drawer doesn't have room for this.

## Goals

- Give admins one place to fully understand a single user: who they are, what they pay,
  how their account is configured, and how active they are — usable for support
  troubleshooting, business/customer-value overview, and configuration verification.
- Feel like a real dashboard page, not a cramped side panel.
- Reuse the existing visual language of `admin-users.html` (dark glass cards, pill
  badges) — no new design system.

## Non-goals (out of scope for this pass)

- Editing vehicle/costs/preferences from the admin panel (read-only for now — editing
  those is the user's own settings flow in `app.html`).
- Full paginated load history (only aggregates + last 10).
- Removing/archiving the old `admin-panel.js` modal code (just stop surfacing its entry
  point; deleting the file is a separate, low-risk cleanup that can happen anytime).
- Lex AI usage detail beyond what's already in `lexProfiles` (avgRPM, stateStats) — no
  new instrumentation.

## Architecture

`admin-users.html` gains a second view mode, switched by a `uid` query param:

- `admin-users.html` (no `uid`) → existing list view, unchanged.
- `admin-users.html?uid=XXX` → new full-page detail view for that user.

Clicking a row in the list navigates to `?uid=XXX` (same-page, using
`history.pushState` so the back button and a direct link both work — no separate HTML
file). The detail view renders a "← Volver a la lista" link back to the bare
`admin-users.html`.

`MOCK_MODE` (`?mock=1`) continues to work the same way for the detail view — the
existing `cf()` mock-routing already applies regardless of which view is rendered, and
`?mock=1&uid=XXX` combines both.

## Sections of the detail page

Stacked blocks (not tabs) so an admin can scan everything in one scroll — this matches
the "support troubleshooting" use case where you want the full picture fast, not
clicking between tabs.

1. **Header** — email, UID, plan/subscription/account-status pills, and the existing
   quick actions (change plan, suspend/reactivate, cancel subscription) always visible
   at the top, not buried below other sections.
2. **Resumen de negocio** — customer-since date, last-active date, current plan value,
   and an alerts line for anything needing attention (e.g. "suscripción cancela el
   15/feb", "cuenta suspendida"). Computed client-side from fields already returned by
   `adminGetUserDetail` — no new backend data needed.
3. **Facturación** — unchanged from today: Stripe subscriptions, recent payments, Stripe
   Dashboard link.
4. **Configuración de la cuenta** *(new)* — vehicle (type, MPG, fuel price), configured
   costs (fuel/maintenance/insurance/depreciation/other CPM, monthly fixed costs), and
   operating preferences (min/target RPM, max deadhead, days/miles per month). All
   already present in the `users/{uid}` document and already returned by
   `adminGetUserDetail` (`profile.costs`, `profile.preferences`) — just not rendered
   today. Read-only key/value display, same visual pattern as the existing "Perfil"
   section.
5. **Actividad** *(new)* — total loads, total revenue, average RPM (aggregated), and a
   table of the last 10 loads (date, route, pay). Academy progress shown as "N/8 módulos
   completados" instead of today's binary "Iniciada/No iniciada".
6. **Notas de admin** — unchanged from today.

## Backend changes

`functions/index.js` → `adminGetUserDetail`:

- Replace the current `loads` count-only query with: aggregate totals (count, sum of
  pay, average RPM) plus the 10 most recent loads (`orderBy('date', 'desc').limit(10)`).
  The `loads` schema has inconsistent legacy field names (confirmed in
  `public/js/history.js`'s own fallback chain) — pay is `totalCharge || rate ||
  totalCost`, RPM is `rpm`, route is `origin`/`destination`. The Cloud Function must
  apply the same fallback chain client code already uses, not just read `totalCharge`
  directly, or older loads will silently compute as $0.
- Academy progress: `academyProgress` doc is already fetched in full; derive "N/8
  completed" from its existing shape (already used by `AcademyProgress` client-side
  logic — reuse the same completion criteria, don't invent a new one).
- No new Firestore reads needed for vehicle/costs/preferences — already included in
  `profile`.
- Extend `functions/test-admin.js` with mock `loads` documents for a seeded test user
  and assert the new aggregates/last-10 shape.

## Old admin panel removal

- Remove the "👑 Admin Panel" section (the `id="adminPanelSection"` block with the
  "Abrir"/"Open" button) from `app.html` → Configuración. "User Control" is the only
  entry point going forward.
- Leave `public/js/admin-panel.js` in place, unreferenced, for now — deleting it is a
  separate cleanup, not required for this feature to ship correctly.

## Testing

- Extend `functions/test-admin.js` (existing mock-Firestore harness, no emulator
  required) to cover the new `loads` aggregation and last-10 list in
  `adminGetUserDetail`.
- Manual verification via `scripts/admin-mock-server.js` (`?mock=1`) for the new page
  sections before touching real data, same workflow already used for this panel.
- Real-account smoke test on production after deploy, same as the previous fix.
