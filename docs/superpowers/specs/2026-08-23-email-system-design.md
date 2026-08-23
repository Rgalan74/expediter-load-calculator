# Email system: compliance fixes and architecture cleanup

**Date:** 2026-08-23
**Status:** Approved, pending implementation plan

## Problem

A site-wide security/privacy pass (Lighthouse audit response, same session) turned up
several unrelated problems in how SmartLoad Solution collects, stores, and sends
email — some broken, some non-compliant, one already fixed:

1. **Contact form is dead.** `contact.html` loads the EmailJS SDK but never calls
   `emailjs.init()` or `emailjs.send()`. `#contactForm` has no submit handler at
   all. Every message a visitor submits through Contact is silently lost — no
   error shown to the visitor, no record anywhere.
2. **No marketing consent gate.** The homepage lead-capture modal (`public/index.html`,
   mirrored in `public/en/index.html`) and the RPM calculator's lead form
   (`public/herramientas/calculadora-rpm.html`) both send name + email + UTM data to
   Brevo's contact list (ID 2) the moment the visitor submits. There is no checkbox —
   only static reassurance text ("No spam. Unsubscribe anytime."). Submitting the form
   is being treated as both "create my account" and "subscribe me to marketing," with
   no way to do one without the other.
3. **PII leaking into GA4.** `public/js/analytics-manager.js`'s `setUserProperty` is
   called from `app.html`'s auth listener with `user_email` set to the user's raw
   email address, sent to Google Analytics as a custom user property. GA4's terms of
   service explicitly prohibit sending directly-identifying data (emails, names) this
   way — the User-ID feature (already in use via `user_id`) is the sanctioned
   mechanism for tying events to a user.
4. **Privacy policy is silent on Brevo.** `public/privacy.html` section 3 ("Compartir
   Información") lists Firebase as the only third party data is shared with. Brevo
   receives name, email, and UTM parameters from two live code paths and is never
   named.
5. **No visibility into transactional email delivery.** Welcome emails (`auth.html`),
   monthly-limit-reached emails (`calculator.js`), and purchase/cancellation emails
   (`functions/index.js`) all work by writing a document to the Firestore `mail`
   collection — the standard trigger contract for Firebase's "Trigger Email from
   Firestore" extension. That extension's actual configuration (which
   SMTP/API provider it forwards to, the sender address/domain, DKIM/SPF setup) lives
   in the Firebase Console, not in this repo, so it can't be verified or documented
   from code. Whatever we write into `privacy.html` about "how we send you email" is
   currently a guess.
6. **Exposed API key — already fixed this session.** `public/js/secrets.js` shipped
   the real Brevo API key to every visitor's browser as a public static file. Key was
   rotated, the homepage modal now calls the existing `subscribeLead` Cloud Function
   (server-side secret) instead of calling Brevo directly, and `secrets.js` was
   deleted. Mentioned here only for completeness — no further action in this plan.

## Goals

- Contact form actually delivers messages somewhere a human will see them, using the
  same Firestore `mail` pattern already relied on for every other outbound email in
  this codebase (no new service to configure/pay for).
- Lead capture always creates the Firestore `leads` record (needed for the
  free-trial/account-creation flow to work), but only adds the contact to Brevo's
  marketing list when the visitor has explicitly opted in via a real checkbox,
  unchecked by default.
- No raw email address (or other directly-identifying field) is ever sent to GA4 as a
  user property. `user_id` (Firebase UID — already in use) remains, since that's
  GA4's sanctioned mechanism.
- `privacy.html` names every third party that receives visitor/user data, including
  Brevo, accurately describing what's sent and why.
- The transactional-email extension's actual provider/sender identity is documented
  once Ricardo confirms it from the Firebase Console, so future privacy-policy or
  deliverability work doesn't start from zero.

## Non-goals (out of scope for this pass)

- Building any new marketing email sequence (welcome drip, trial-ending reminder,
  re-engagement, newsletter). That is a content/strategy exercise, not a code fix —
  tracked separately in `docs/email-marketing-strategy.md`, to be scheduled and
  executed on its own once this compliance/architecture pass is live.
- Migrating off Brevo or adding a second ESP. Brevo already has a working,
  server-side-secured integration (`subscribeLead`); nothing here suggests it's the
  wrong tool.
- Retroactively re-consenting or purging existing Brevo contacts collected before this
  fix. Ricardo may want to do this manually in Brevo later; it's a data-cleanup
  decision, not a code change.
- Fixing `lexTrialEndsAt` having no proactive email reminder before/at expiration
  (today it's in-app UI only, `public/js/lex.js:438`). Real gap, but it's a new
  sequence to build, not a bug to fix — belongs in the strategy doc, not this plan.
- Auditing every other page for its own copy of Google/Meta tracking scripts for PII
  leaks beyond the one already found (`user_email`) — this pass fixes the one
  confirmed instance; a broader PII audit of all analytics events is separate work if
  wanted later.

## Architecture

### 1. Contact form → new Cloud Function `sendContactMessage` (no EmailJS)

Checked `firestore.rules:234-239` first: the `mail` collection's `create` rule
requires `isAuthenticated()` **and** `request.resource.data.to == request.auth.token.email`
— a client can only ever create a `mail` doc addressed to their own logged-in email.
That's exactly right for the welcome email (`auth.html`, sent to the user who just
registered) but wrong for Contact: the visitor is anonymous and the message needs to
go to `support@smartloadsolution.com`, not to themselves. Loosening that rule to allow
an arbitrary `to` would turn `mail` into an open relay anyone could use to send email
to any address through SmartLoad's sending domain — not acceptable.

So Contact needs a Cloud Function, not a direct client write — same shape as
`subscribeLead` (anonymous `onCall`, validates input, then does the privileged write
via the Admin SDK, which bypasses `firestore.rules` entirely). New function
`sendContactMessage`:

- Validates `name`, `email` (regex, same pattern `subscribeLead` already uses),
  `subject` (must be one of the 5 fixed option values already in the form), and
  `message` (non-empty, capped length to block abuse).
- Hardcodes `to: ['support@smartloadsolution.com']` server-side — the visitor's input
  can never control the recipient.
- Writes to Firestore `mail` via the Admin SDK (`admin.firestore()`, not the client
  SDK, so the `firestore.rules` restriction above doesn't apply — Admin SDK writes
  always bypass rules, same as every other Admin-SDK write already in
  `functions/index.js`).
- Sets `reply-to` in the email body to the visitor's own address so `support@` can
  reply directly from their inbox.

The EmailJS `<script>` tag in `contact.html`/`en/contact.html` is removed — it was
never functional and this approach makes it fully redundant.

### 2. Marketing-consent checkbox on both lead forms

Both lead forms (`public/index.html`/`en/index.html`'s SLS modal, and
`public/herramientas/calculadora-rpm.html`) get an unchecked-by-default checkbox:

> ☐ Quiero recibir tips y actualizaciones por email (opcional)
> *(EN: "I'd like to receive tips and updates by email (optional)")*

The Firestore `leads` write always happens (unconditionally) — that record is what
lets the free-trial signup flow work and is first-party data about SmartLoad's own
funnel, not a marketing list. The call to the `subscribeLead` Cloud Function (which
adds the contact to Brevo) only fires when the checkbox is checked. `subscribeLead`
itself doesn't change — the gating happens client-side, before the call.

### 3. Remove `user_email` from GA4

`analytics-manager.js`'s `setUserProperty` calls stay as a general-purpose method
(other properties may be legitimate), but the specific call site in `app.html`'s auth
listener that passes `user_email` is deleted. `user_id` (Firebase UID) stays.

### 4. `privacy.html` section 3 update

Add a line naming Brevo specifically: what's sent (name, email, UTM parameters),
for what purpose (product updates and marketing communications, only when
opted in), and that visitors can unsubscribe via the link in any Brevo email. Add a
second line for the transactional-email provider once Ricardo reports which one is
configured in the Firebase Console (placeholder language until then — see Task in
the implementation plan).

## Decisions worth flagging back to Ricardo

- **Consent checkbox wording/placement** — drafted above, but this is customer-facing
  copy; confirm it reads right in both languages before shipping.
- **Firebase "Trigger Email" extension provider** — needs a manual check in the
  Firebase Console (Extensions tab) to name it accurately in the privacy policy.
- **Existing Brevo contacts** — everyone already in list 2 was added before any
  consent checkbox existed. Whether to leave them, re-permission them, or purge is
  Ricardo's call, not something this plan does automatically.
