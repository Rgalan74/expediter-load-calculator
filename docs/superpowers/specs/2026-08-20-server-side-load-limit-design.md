# Server-side enforcement of the free-plan monthly load limit

**Date:** 2026-08-20
**Status:** Approved, pending implementation plan

## Problem

The free/Starter plan is limited to 30 saved loads per calendar month
(`public/js/userPlans.js`, `PLANS.free.limits.maxLoadsPerMonth`). Today this limit
is enforced **only in the browser**: `calculator.js`'s `saveLoad()` checks
`canCreateMoreLoads()` before writing, and `firestore.rules` only validates that a
new `loads` document has the right owner, required fields, and numeric bounds — it
never checks the limit or the user's plan at all.

This means the limit is real for a normal user going through the UI, but is fully
bypassable by anyone willing to write directly to Firestore (browser console, a
modified client, or any tool using the Firebase SDK with a valid user session) —
nothing on the server ever says no. The `loadsThisMonth` counter used for the
check is itself just a plain field on `users/{uid}` with no rule protecting it, so
even the counter can be reset or inflated/deflated by the client.

## Goals

- Make the 30-loads/month limit for the free plan actually enforced by the
  server, not just suggested by the UI.
- Keep the fix scoped to the create/limit path — don't touch or reimplement the
  load-calculation math (fuel cost, net profit, margin, etc.), which stays exactly
  as it is today, computed client-side.
- No behavior change for paying users (professional/premium/admin), who have
  `maxLoadsPerMonth: -1` (unlimited) and are unaffected by the limit check.
- No behavior change for editing an existing load — edits never counted against
  the monthly limit and continue not to.
- Preserve the existing UX (upgrade modal, "limit reached" email, "≤5 remaining"
  warning) — this is about closing the enforcement gap, not changing what the
  user sees when they hit the limit.

## Non-goals (out of scope for this pass)

- Enforcing the 30-day history-retention restriction (`historyDays`) — that's a
  read-side UI filter today (`history.js` queries only recent loads), not a
  creation limit, and would need a different mechanism (a Firestore read rule).
  Separate piece of work if wanted later.
- The 14-day Lex AI trial (`lexTrialEndsAt`) — unrelated to the loads-per-month
  limit; not touched by this change.
- The legacy `users/{userId}/loads/{loadId}` subcollection referenced in
  `firestore.rules` (`allow read, write: if isOwner(userId)`, no validation at
  all) — `calculator.js` writes to the top-level `loads` collection, not this
  nested one; it appears unused. Not touched here — if it turns out to be dead,
  removing it is a separate, low-risk cleanup.
- Fixing the pre-existing "starter" plan gap: `PLANS` in `userPlans.js` has no
  `starter` key, so a user whose `plan` field is literally `'starter'` (settable
  via the admin panel's plan dropdown) currently falls back to `PLANS.free`'s
  limits under `PLANS[planId] || PLANS.free`. This fix replicates that exact
  fallback server-side for consistency with existing behavior — it does not fix
  or change the underlying "starter has no defined plan" gap, which is a
  pre-existing, separate issue.

## Architecture

### New Cloud Function: `createLoad`

- `onCall`, region `us-central1`, in `functions/index.js`, alongside the existing
  callable functions. Requires an authenticated caller
  (`if (!request.auth) throw new HttpsError('unauthenticated', ...)`) — any
  signed-in user, not admin-only (unlike `adminGetUsers` etc.).
- Becomes the **only** legitimate way to create a new `loads` document. It does
  not recompute any of the derived business numbers (`fuelCost`, `netProfit`,
  `profitMargin`, etc.) — it receives the already-computed `loadData` object from
  the client (exactly what `calculator.js` builds today) and is responsible only
  for: resolving the caller's real plan, checking the limit, validating the
  payload shape, and performing the write.

**Plan resolution (server-side), replicating `getUserPlan()`'s exact logic:**

1. Read `users/{uid}`. If `role === 'admin'`, the plan is `admin` (unlimited) —
   skip straight to the write.
2. Otherwise, query `customers/{uid}/subscriptions` for a document with
   `status == 'active'`. If one or more exist, map each `items[0].price.id`
   through the existing `PRICE_TO_PLAN` constant already defined in
   `functions/index.js` (used today by `stripeWebhook`), and take the
   highest-priority match (`premium` > `professional` > `free`) — mirroring the
   client's `PLAN_PRIORITY` resolution exactly, so the server never disagrees
   with what the client already computed for the same user.
3. If no active subscription, fall back to `users/{uid}.plan || 'free'`.

**Limit lookup:** a small server-side constant,

```js
const PLAN_LOAD_LIMITS = { free: 30, professional: -1, premium: -1, admin: -1 };
```

looked up as `PLAN_LOAD_LIMITS[planId] ?? PLAN_LOAD_LIMITS.free` — the `?? free`
fallback replicates `PLANS[planId] || PLANS.free`'s existing behavior for an
unrecognized plan value (e.g. `'starter'`), so behavior stays identical to today
for that edge case. This constant is a deliberate, small duplication of
`public/js/userPlans.js`'s `PLANS.<plan>.limits.maxLoadsPerMonth` values — the
same pattern already used elsewhere in this codebase (e.g.
`ACADEMY_MODULE_LESSONS` in `functions/index.js` duplicating
`public/academy/js/academy.js`'s module/lesson counts). A comment on the constant
must say it needs to stay in sync with `userPlans.js` if those numbers ever
change.

**Atomic check-and-write:** inside a single Firestore transaction
(`db.runTransaction`):

1. Read `users/{uid}` for `loadsThisMonth` and `monthStartDate`.
2. Compute the effective current count: if `monthStartDate` is missing or falls
   in a different calendar month than now, treat the count as `0` (mirroring
   `incrementMonthlyLoads()`'s existing month-rollover reset logic) — otherwise
   use the stored `loadsThisMonth`.
3. If `maxLoadsPerMonth !== -1 && effectiveCount >= maxLoadsPerMonth`, throw
   `HttpsError('resource-exhausted', 'Límite de cargas del mes alcanzado')`
   without writing anything.
4. Otherwise: validate the incoming `loadData` the same way
   `firestore.rules`' `hasRequiredFields()`/`hasValidNumbers()` do today (keys
   `userId, origin, destination, totalMiles, rpm, totalCharge` present; `rpm` in
   `[0, 50]`, `totalMiles` in `[0, 10000]`, `totalCharge` in `[0, 500000]`) —
   throw `HttpsError('invalid-argument', ...)` if not. This validation moves into
   the function because the function writes via the Admin SDK, which bypasses
   `firestore.rules` entirely — without replicating these checks here, moving
   creation into a Cloud Function would silently drop validation that exists
   today.
5. Overwrite `userId` with `request.auth.uid` and `createdAt` with the server
   transaction's timestamp, regardless of what the client submitted for those
   two fields — never trust client-submitted identity or time, matching the
   spirit of the current rule's `request.resource.data.userId == request.auth.uid`
   check (which this replaces).
6. Create the new `loads` document (auto-ID) with the validated data.
7. Write `users/{uid}` with either `{ loadsThisMonth: 1, monthStartDate: now }`
   (month rolled over) or `{ loadsThisMonth: increment(1) }` (same month) — in
   the same transaction as step 6, so the create and the counter update are
   atomic: they either both happen or neither does.
8. Return `{ id: <new doc id> }` to the caller.

### Firestore rules change

In `firestore.rules`, the `loads` collection's `allow create` rule changes from
its current field/bounds check to:

```
allow create: if false;
```

This blocks every direct client attempt to create a `loads` document — the only
way to create one becomes the `createLoad` function (Admin SDK writes always
bypass security rules). `allow read`, `allow update`, and `allow delete` on
`loads` are **unchanged** — editing and deleting your own loads, and reading your
own loads, work exactly as they do today.

### Client changes (`public/js/calculator.js`)

- In `saveLoad()`, the **new-load branch only** (`if (existingLoadId)` stays
  untouched) replaces:
  ```js
  const doc = await window.db.collection('loads').add(loadData);
  ```
  with a call to the new callable function (via the same
  `firebase.app().functions('us-central1').httpsCallable(...)` pattern already
  used throughout this codebase, e.g. in `admin-users.html`'s `cf()` helper).
- The existing client-side pre-check (`canCreateMoreLoads`, the upgrade modal,
  and the "limit reached" email) is **left in place, unchanged** — it's still a
  useful instant-feedback layer that avoids a round-trip for the common case.
- New: if the `createLoad` call itself rejects with code `resource-exhausted`
  (meaning the client's own pre-check was wrong or stale — e.g. two browser tabs
  saving concurrently), the client shows the same `showUpgradeModal(...)` it
  already shows for the client-side-detected case, so the user experience is
  identical either way; it doesn't leak a raw Cloud Functions error message.
- The existing post-save call to `window.incrementMonthlyLoads(...)` is **removed**
  for the new-load case, since `createLoad` now increments the counter
  atomically as part of its own transaction — leaving the old call in place would
  double-count every new load.

## Error handling

- `unauthenticated` — caller has no valid auth token (shouldn't normally happen
  since the calculator UI requires sign-in, but the function checks anyway rather
  than trusting the client).
- `resource-exhausted` — over the plan's monthly limit. Client maps this to the
  existing upgrade-modal UX.
- `invalid-argument` — payload missing required fields or a number out of bounds.
  This should be unreachable through the normal UI (the client already validates
  before calling), so on the client this can surface as a generic "no se pudo
  guardar la carga" error rather than needing special UX — it's a defense against
  a non-standard caller, not an expected user-facing path.
- Any other error (e.g. a Firestore transaction failure) propagates as `internal`
  and the client shows its existing generic save-error handling.

## Testing

- New test file `functions/test-createLoad.js`, following the exact mocked-
  Firestore pattern already established in `functions/test-admin.js` (monkey-
  patch `firebase-admin`/`firebase-functions` module loading, in-memory `STORE`,
  no emulator required). Covers:
  - A free-plan user under the limit succeeds and the returned doc has
    `userId`/`createdAt` set server-side even if the client submitted different
    values for those fields.
  - A free-plan user exactly at the limit (`loadsThisMonth === 30`) is rejected
    with `resource-exhausted`, and no `loads` document or counter change happens
    (transaction fully rolled back).
  - A free-plan user whose `monthStartDate` is in a previous calendar month
    succeeds even if their stale `loadsThisMonth` was already 30, and the
    counter resets to `1` with a fresh `monthStartDate`.
  - A professional/premium/admin-role user succeeds regardless of
    `loadsThisMonth` (unlimited).
  - A user with `plan: 'starter'` (the undefined-plan edge case) is treated as
    free-tier (limit 30), matching today's client fallback behavior.
  - A payload missing a required field, or with `rpm`/`totalMiles`/`totalCharge`
    out of bounds, is rejected with `invalid-argument`.
  - A call with no `request.auth` is rejected with `unauthenticated`.
  - A user whose active Stripe subscription (`customers/{uid}/subscriptions`,
    `status: 'active'`) maps to `professional`/`premium` is treated as that plan
    even if `users/{uid}.plan` still says `free` (stale/unsynced field) —
    confirms the Stripe-subscription-priority resolution logic works.
- Manual/code-review verification (no emulator, no live Firebase project touched
  during implementation): re-read `calculator.js`'s modified `saveLoad()` against
  the original to confirm the edit branch is untouched and the new-load branch
  correctly calls the function and handles both the pre-check and server-rejection
  paths.
- Real-account smoke test on production after deploy: as an admin, temporarily
  set a test account's plan to `free` and `loadsThisMonth` close to 30 via the
  admin panel or Firestore console, save loads through the real calculator UI
  until hitting the limit, and confirm the upgrade modal appears and the 31st
  load is genuinely not saved (check Firestore directly, not just the UI).
