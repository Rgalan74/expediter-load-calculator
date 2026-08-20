# Lock down server-owned fields on users/{uid}

**Date:** 2026-08-20
**Status:** Approved, pending implementation plan
**Relates to:** `docs/superpowers/specs/2026-08-20-server-side-load-limit-design.md` — found
during code review of that plan's Task 2 (`createLoad`), not part of the original design.

## Problem

`createLoad` (the new Cloud Function enforcing the free plan's 30-loads/month limit)
resolves the caller's plan and current usage by reading `users/{uid}.plan`,
`.loadsThisMonth`, and `.monthStartDate`. A code quality review found that
`firestore.rules`'s `users/{userId}` rule only blocks `role`/`roleAssignedBy`/
`roleAssignedAt`/`permissions` from client writes — every other field, including
these three, is freely writable by the document's own owner via the ordinary
client Firestore SDK.

Concretely: `db.collection('users').doc(myUid).update({ plan: 'premium' })` or
`.update({ loadsThisMonth: 0 })`, run from a browser console with a valid session,
fully defeats `createLoad`'s enforcement — the very thing that plan exists to fix.
`subscriptionStatus`/`subscriptionId` have the identical problem for the same reason
(`_resolveUserPlan` only trusts the Stripe subscription lookup when one exists;
otherwise it reads these fields as the fallback).

## Why this wasn't caught during the original design

The original spec assumed protecting `loads`' `create` rule was sufficient because
that's where the exploit was first identified (bypassing the load-count check).
It didn't audit whether the *inputs* to the new check (`plan`, the counter fields)
were themselves tamper-proof — they weren't.

## Investigation: what already legitimately writes these fields

- `functions/index.js`'s `activateUserPlan()` (called by the existing `stripeWebhook`
  on `checkout.session.completed`/`customer.subscription.updated`/
  `invoice.payment_succeeded`) already writes `plan`/`subscriptionStatus`/
  `subscriptionId` to `users/{uid}` via the Admin SDK. **This is the real,
  authoritative sync mechanism** — Admin SDK writes bypass security rules entirely,
  so locking down client writes to these fields does not affect it.
- `functions/index.js`'s `adminUpdateUser` (`setPlan` operation, used by the admin
  panel) also writes via the Admin SDK — unaffected by any rules change.
- `public/js/userPlans.js`'s `getUserPlan()` *also* writes `plan`/`subscriptionStatus`/
  `subscriptionId` back to `users/{uid}` from the client (lines ~178-184), every time
  it detects an active Stripe subscription — but this is a **redundant** cache-refresh
  on top of what `activateUserPlan()` already keeps in sync server-side. It is not
  the mechanism actually keeping plan data correct.
- `public/js/userPlans.js`'s `initializeUserPlan()` (called directly from
  `public/auth.html`'s signup handler, before that handler writes its own
  `fullName`/`phone`/`preferredLanguage` fields a few lines later) writes
  `plan: 'free'`, `subscriptionStatus: 'active'`, `loadsThisMonth: 0`, and
  `monthStartDate: <now>`. This is the *first* write to `users/{uid}`, so it's
  evaluated by Firestore as a **create**, not an update — but the new `create` rule
  (see Architecture) requires these same fields to be absent there too, so this
  write would still be blocked if left unchanged.

## Goals

- Make `plan`, `subscriptionStatus`, `subscriptionId`, `loadsThisMonth`, and
  `monthStartDate` on `users/{uid}` genuinely server-owned: readable by the owner,
  writable only via Admin SDK (Cloud Functions), never by the client SDK — for both
  `update` (the exploit path) and `create` (an attacker could delete their own
  profile and recreate it with these fields pre-set, sidestepping `update` checks
  entirely).
- Do this without breaking signup, login, or the admin panel's plan management —
  all three are audited above and confirmed to route through Admin SDK paths that
  are unaffected by client-side rule changes.
- Keep the fix minimal: adjust the two client call sites that currently (redundantly
  or now-unnecessarily) write these fields, rather than re-architecting account
  creation or the plan-sync flow.

## Non-goals

- Fixing `accountStatus` or any other admin-managed field not implicated in the
  `createLoad` limit check — out of scope, not part of this vulnerability.
- Investigating why `initializeUserPlan()` sets a brand-new free user's
  `subscriptionStatus` to `'active'` rather than `'none'` — that's existing,
  unrelated behavior this fix doesn't need to understand or change, since the field
  is being removed from that write entirely (see Architecture).
- Testing `firestore.rules` with the Firebase Local Emulator Suite. This codebase's
  established testing approach (used throughout this session) is a lightweight
  mocked-Admin-SDK pattern that cannot exercise security rules at all — rules only
  apply to client SDK requests, enforced by the real Firestore backend. Introducing
  emulator-based rules testing would be new infrastructure for this project. Given
  the existing pattern for `firestore.rules` changes in this codebase (the original
  plan's `allow create: if false;` change for `loads` was also unit-test-free),
  this fix relies on careful manual rule review plus a manual production smoke test
  instead.

## Architecture

### `firestore.rules`

Two new helper functions, placed near the existing `isModifyingRoleFields()`:

```
function isModifyingServerOwnedFields() {
  return request.resource.data.diff(resource.data).affectedKeys()
    .hasAny(['plan', 'subscriptionStatus', 'subscriptionId', 'loadsThisMonth', 'monthStartDate']);
}
function hasNoServerOwnedFieldsAtCreate() {
  return !request.resource.data.keys().hasAny(
    ['plan', 'subscriptionStatus', 'subscriptionId', 'loadsThisMonth', 'monthStartDate']
  );
}
```

`users/{userId}`'s rules become:

```
allow read: if isOwner(userId) || isAdminByRole();
allow create: if isOwner(userId) && hasNoServerOwnedFieldsAtCreate();
allow update: if isOwner(userId) && !isModifyingRoleFields() && !isModifyingServerOwnedFields();
allow update: if isAdminByRole() && isModifyingRoleFields();
allow delete: if isOwner(userId);
```

Only the `create` rule and the first `update` rule change — the admin-role `update`
rule and `delete` are untouched. Since no legitimate client-side write ever needs to
set these five fields anymore (see below), `hasNoServerOwnedFieldsAtCreate()`
requires them to be **absent** at creation, not merely "present with a safe value" —
simpler to write and simpler to reason about than allowing a restricted value set.

### `public/js/userPlans.js`

**`initializeUserPlan()`**: remove `plan`, `subscriptionStatus`, `loadsThisMonth`,
and `monthStartDate` from the written object entirely — keep `email`,
`lexTrialEndsAt`, `createdAt`, `updatedAt`. A user whose doc has no `plan` field is
already handled correctly everywhere it's read: `getUserPlan()`'s own fallback is
`userData.plan || 'free'`, and `createLoad`'s `_resolveUserPlan` has the equivalent
`planId || userData.plan || 'free'`. A missing `loadsThisMonth`/`monthStartDate` is
likewise already handled — `createLoad`'s transaction treats a missing/null
`monthStartDate` as "month rolled over," initializing both fields on the first load
a user ever saves. No caller anywhere needs these fields to exist before that point.

**`getUserPlan()`**: remove the `.set({ plan, subscriptionStatus, subscriptionId,
updatedAt }, { merge: true })` call (redundant with `activateUserPlan()`, and would
now be rejected by the rules change). Keep every other line unchanged — the
function still resolves and **returns** the correct plan object to its caller; it
just stops trying to write it back to Firestore. Without this removal, the rules
change would make this call throw a `permission-denied` on every login for every
paying user, which the function's existing outer `catch` would silently swallow —
incorrectly falling back to a default free-tier plan object and making paying
users appear as free-tier in the UI. This removal is required, not optional
cleanup.

## Testing

- No automated test for the `firestore.rules` change itself, per the Non-goals
  section — this codebase has no emulator-based rules testing today, and adding
  that infrastructure is out of scope for this fix.
- Manual review: read the final `firestore.rules` diff and confirm by inspection
  that `activateUserPlan()`, `adminUpdateUser`'s `setPlan`, and `createLoad` (all
  three Admin SDK-based) are structurally unaffected by a client-facing rules
  change — they don't go through `firestore.rules` at all.
- Manual review: read `public/js/userPlans.js`'s two modified functions and confirm
  no other code in the same file (or `public/js/config.js`, which calls both) reads
  a field this change stops writing in a way that would break without a fallback —
  cross-check every read site of `plan`/`subscriptionStatus`/`subscriptionId`/
  `loadsThisMonth`/`monthStartDate` in `userPlans.js` specifically.
- Manual smoke test after deploy (folded into the original plan's existing Task 5
  smoke-test step, not a separate deploy): sign up a brand-new test account and
  confirm it lands on the free plan correctly with no console errors; log in as an
  existing paying test account and confirm it still shows the correct paid plan
  (proves `activateUserPlan`/webhook sync is unaffected and the client's redundant
  write removal didn't break anything); attempt
  `db.collection('users').doc(<own uid>).update({ plan: 'premium' })` from the
  browser console while logged in and confirm it's rejected with a permission
  error.
