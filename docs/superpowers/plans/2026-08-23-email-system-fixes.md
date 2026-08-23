# Email System Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Contact form actually deliver messages, gate marketing-list signup behind an explicit opt-in checkbox on both lead forms, stop sending the user's raw email to GA4 as a property, and make `privacy.html` name Brevo as the third party it actually is.

**Architecture:** A new callable Cloud Function `sendContactMessage` (same anonymous-`onCall` + Admin-SDK-write shape as the existing `subscribeLead`) replaces the dead EmailJS integration — `firestore.rules`' `mail` collection rule only allows a client to email *itself*, so Contact (emailing `support@`) needs server-side privilege, not a rule change. Both lead forms (homepage SLS modal, RPM calculator) get an unchecked-by-default checkbox that gates the existing `subscribeLead` call — the Firestore `leads` write stays unconditional either way. `analytics-manager.js`'s one `setUserProperty('user_email', ...)` call site is deleted. `privacy.html` (ES + EN) gets a new line naming Brevo.

**Tech Stack:** Firebase Cloud Functions v2 (`onCall`), Firestore Admin SDK (`db.collection("mail").add(...)`), vanilla JS callable-function invocation on the client (`firebase.app().functions('us-central1').httpsCallable(...)`) — no new dependencies, no new secrets.

**Reference spec:** `docs/superpowers/specs/2026-08-23-email-system-design.md`

---

## Task 1: Backend — write the failing test for `sendContactMessage`

**Files:**
- Create: `functions/test-sendContactMessage.js`

Follows the exact mocked-Firestore + intercepted-`require` pattern already established in `functions/test-createLoad.js` — self-contained, no emulator needed, run with plain `node`.

- [ ] **Step 1: Write the complete test file**

Create `functions/test-sendContactMessage.js`:

```js
/**
 * test-sendContactMessage.js — Test unitario aislado de sendContactMessage.
 * No requiere emulador ni producción: mockea firebase-admin, firebase-functions.
 * Ejecutar: node functions/test-sendContactMessage.js
 */

const Module = require('module');

// ─── Mock Firestore "mail" collection ────────────────────────────────────────
const STORE = { mail: {} };
let _autoIdCounter = 0;

const db = {
    collection(name) {
        return {
            add(data) {
                const id = 'auto_' + (++_autoIdCounter);
                STORE[name] = STORE[name] || {};
                STORE[name][id] = data;
                return Promise.resolve({ id });
            },
        };
    },
};

// ─── Mock firebase-admin ─────────────────────────────────────────────────────
const adminMock = {
    initializeApp() {},
    firestore: Object.assign(() => db, {}),
    apps: [{}],
};

// ─── Mock firebase-functions ───────────────────────────────────────────────
class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; this.details = message; }
}
function onCall(opts, handler) {
    return async (request) => handler(request);
}
const fnV2 = {
    HttpsError,
    onCall,
    onRequest(opts, handler) { return { __onRequest: true }; },
    onSchedule(opts, handler) { return { __onSchedule: true }; },
    setGlobalOptions() {},
};
const loggerMock = { info() {}, warn() {}, error() {}, debug() {} };

// ─── Mock stripe / express (index.js requires them at top-level) ────────────
class StripeMock {
    constructor() {
        this.subscriptions = { update: () => Promise.resolve({}), list: () => Promise.resolve({ data: [] }) };
    }
}

// ─── Interceptar requires ────────────────────────────────────────────────────
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'firebase-admin') return adminMock;
    if (request === 'firebase-functions/v2/https') return fnV2;
    if (request === 'firebase-functions/v2/scheduler') return fnV2;
    if (request === 'firebase-functions/v2') return fnV2;
    if (request === 'firebase-functions/logger') return loggerMock;
    if (request === 'stripe') return StripeMock;
    if (request === 'express') { const e = () => ({ use() {}, post() {}, get() {} }); e.raw = () => ({}); e.json = () => ({}); e.urlencoded = () => ({}); return e; }
    return origLoad.apply(this, arguments);
};

process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
const fns = require('./index.js');

// ─── Utilidades de test ──────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const VALID_MSG = {
    name: 'Ricardo Galan',
    email: 'ricardo@example.com',
    subject: 'support',
    message: 'Mi calculadora no guarda las cargas.',
    lang: 'es',
};

(async () => {
    const call = (data) => fns.sendContactMessage({ auth: null, data: data || {} });

    section('sendContactMessage — validacion de email');
    try {
        await call({ ...VALID_MSG, email: 'not-an-email' });
        assert(false, 'email invalido debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'email invalido lanza invalid-argument (' + e.code + ')');
    }

    section('sendContactMessage — validacion de subject');
    try {
        await call({ ...VALID_MSG, subject: 'not-a-real-option' });
        assert(false, 'subject fuera de la lista permitida debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'subject invalido lanza invalid-argument (' + e.code + ')');
    }

    section('sendContactMessage — validacion de message vacio');
    try {
        await call({ ...VALID_MSG, message: '   ' });
        assert(false, 'message vacio debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'message vacio lanza invalid-argument (' + e.code + ')');
    }

    section('sendContactMessage — envio valido');
    const r1 = await call(VALID_MSG);
    assert(r1.success === true, 'devuelve success: true');
    const mailDocs = Object.values(STORE.mail);
    assert(mailDocs.length === 1, 'escribe exactamente un documento en mail');
    const doc = mailDocs[0];
    assert(JSON.stringify(doc.to) === JSON.stringify(['support@smartloadsolution.com']), 'to es siempre support@smartloadsolution.com, ignora cualquier input del visitante (' + JSON.stringify(doc.to) + ')');
    assert(doc.message.subject === 'Nuevo mensaje de contacto: Soporte Técnico', 'el subject usa la etiqueta legible de la categoria, no la key tecnica (' + doc.message.subject + ')');
    assert(doc.message.html.includes('Ricardo Galan'), 'el html incluye el nombre del visitante');
    assert(doc.message.html.includes('ricardo@example.com'), 'el html incluye el email del visitante para poder responder');
    assert(doc.message.html.includes('Mi calculadora no guarda las cargas.'), 'el html incluye el mensaje del visitante');

    section('sendContactMessage — lang=en cambia el subject a ingles');
    const r2 = await call({ ...VALID_MSG, lang: 'en' });
    assert(r2.success === true, 'devuelve success: true con lang en');
    const mailDocs2 = Object.values(STORE.mail);
    const lastDoc = mailDocs2[mailDocs2.length - 1];
    assert(!lastDoc.message.subject.includes('Nuevo mensaje'), 'con lang en, el subject no usa el texto en espanol');

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node functions/test-sendContactMessage.js`
Expected: FAIL with `TypeError: fns.sendContactMessage is not a function` (the function doesn't exist yet)

---

## Task 2: Backend — implement `sendContactMessage`

**Files:**
- Modify: `functions/index.js` (add after the existing `subscribeLead` export, around line 1127)

- [ ] **Step 1: Add the function**

In `functions/index.js`, immediately after the closing `);` of `exports.subscribeLead` (around line 1127), add:

```js
// ============================================================
// sendContactMessage — formulario de Contacto (OCULTO)
// Reemplaza la integracion EmailJS que nunca estuvo conectada.
// Escribe a Firestore "mail" via Admin SDK (bypassa firestore.rules,
// que solo permite a un usuario logueado mandarse mail a si mismo) con
// "to" fijo en support@smartloadsolution.com -- el visitante nunca
// controla el destinatario.
// (c) 2026 SmartLoad Solution - Ricardo Galan.
// ============================================================
const CONTACT_SUBJECTS = {
    general: { es: 'Consulta General', en: 'General Inquiry' },
    support: { es: 'Soporte Técnico', en: 'Technical Support' },
    billing: { es: 'Facturación / Plan', en: 'Billing / Plan' },
    feature: { es: 'Solicitud de Funcionalidad', en: 'Feature Request' },
    partnership: { es: 'Partnership / Negocios', en: 'Partnership / Business' },
};

exports.sendContactMessage = onCall(
    { region: 'us-central1' },
    async (request) => {
        const data = request.data || {};

        const name = String(data.name || '').trim().slice(0, 100);
        const email = String(data.email || '').trim().toLowerCase();
        const subjectKey = String(data.subject || '').trim();
        const message = String(data.message || '').trim().slice(0, 5000);
        const lang = data.lang === 'en' ? 'en' : 'es';

        if (!name) {
            throw new HttpsError('invalid-argument', 'Name is required');
        }
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            throw new HttpsError('invalid-argument', 'Valid email is required');
        }
        if (!CONTACT_SUBJECTS[subjectKey]) {
            throw new HttpsError('invalid-argument', 'Valid subject is required');
        }
        if (!message) {
            throw new HttpsError('invalid-argument', 'Message is required');
        }

        const subjectLabel = CONTACT_SUBJECTS[subjectKey][lang];
        const subjectLine = lang === 'en'
            ? `New contact message: ${subjectLabel}`
            : `Nuevo mensaje de contacto: ${subjectLabel}`;

        const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2>${lang === 'en' ? 'New contact form message' : 'Nuevo mensaje del formulario de contacto'}</h2>
        <p><strong>${lang === 'en' ? 'Name' : 'Nombre'}:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>${lang === 'en' ? 'Category' : 'Categoría'}:</strong> ${subjectLabel}</p>
        <p><strong>${lang === 'en' ? 'Message' : 'Mensaje'}:</strong></p>
        <p style="white-space:pre-wrap;border-left:3px solid #ccc;padding-left:12px;">${message}</p>
      </div>
    `;

        try {
            await db.collection('mail').add({
                to: ['support@smartloadsolution.com'],
                replyTo: email,
                message: {
                    subject: subjectLine,
                    html,
                },
            });
            logger.info(`[sendContactMessage] Mensaje de contacto recibido de: ${email}`);
            return { success: true };
        } catch (e) {
            logger.error('[sendContactMessage] Error escribiendo a mail:', e.message);
            throw new HttpsError('internal', 'Error sending message');
        }
    }
);
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node functions/test-sendContactMessage.js`
Expected: `RESULTADO: 9 pasaron, 0 fallaron` (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add functions/index.js functions/test-sendContactMessage.js
git commit -m "feat(functions): add sendContactMessage, replaces dead EmailJS integration"
```

---

## Task 3: Backend — deploy `sendContactMessage`

**Files:** none (deploy step only)

- [ ] **Step 1: Deploy just this function**

Run: `npx firebase deploy --only functions:sendContactMessage`
Expected: `+  functions[sendContactMessage(us-central1)] Successful create operation.` and `Deploy complete!`

(If it fails with `Error: User code failed to load. Cannot determine backend specification. Timeout after 10000` — this is a known transient issue with this project's local Firebase CLI analysis step, unrelated to the code. Just retry the same command.)

---

## Task 4: Frontend — wire `contact.html` to `sendContactMessage`, remove EmailJS

**Files:**
- Modify: `public/contact.html`

- [ ] **Step 1: Remove the EmailJS script tag**

Find (around line 286):

```html
  <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
```

Delete that line entirely.

- [ ] **Step 2: Add the Firebase SDK scripts**

`contact.html` currently loads no Firebase SDK at all. Add these lines right before the closing `</head>` (match the placement/style already used on `public/index.html`):

```html
  <script defer src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script defer src="https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js"></script>
```

- [ ] **Step 3: Add a status message element and wire the submit handler**

Find the submit button (around line 196-199):

```html
            <button type="submit" id="submitBtn" class="btn-primary">
              <span id="submitBtnText" data-i18n="contact.btn_send">Enviar Mensaje</span>
              <span>→</span>
            </button>

            <p class="text-center text-sm text-gray-500 mt-4" data-i18n="contact.respond_note">Respondemos todos los mensajes en menos de 48 horas.</p>
          </form>
```

Replace with (adds a status paragraph right after the button, before the existing response-time note):

```html
            <button type="submit" id="submitBtn" class="btn-primary">
              <span id="submitBtnText" data-i18n="contact.btn_send">Enviar Mensaje</span>
              <span>→</span>
            </button>
            <p id="contactStatus" style="display:none;margin-top:0.5rem;font-size:0.875rem;"></p>

            <p class="text-center text-sm text-gray-500 mt-4" data-i18n="contact.respond_note">Respondemos todos los mensajes en menos de 48 horas.</p>
          </form>
```

Then, right before the closing `</body>` tag, add:

```html
  <script>
    (function () {
      var firebaseConfig = {
        apiKey: "AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY",
        authDomain: "expediter-dev.firebaseapp.com",
        projectId: "expediter-dev",
        storageBucket: "expediter-dev.appspot.com",
        messagingSenderId: "447653997176",
        appId: "1:447653997176:web:4e356867bb64b488ab5b8d"
      };
      document.addEventListener("DOMContentLoaded", function () {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

        var form = document.getElementById("contactForm");
        var btn = document.getElementById("submitBtn");
        var btnText = document.getElementById("submitBtnText");
        var status = document.getElementById("contactStatus");

        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          var name = document.getElementById("name").value.trim();
          var email = document.getElementById("email").value.trim().toLowerCase();
          var subject = document.getElementById("subject").value;
          var message = document.getElementById("message").value.trim();

          btn.disabled = true;
          var originalText = btnText.textContent;
          btnText.textContent = "Enviando...";
          status.style.display = "none";

          try {
            var fn = firebase.app().functions('us-central1').httpsCallable('sendContactMessage');
            var result = await fn({ name: name, email: email, subject: subject, message: message, lang: 'es' });
            if (result && result.data && result.data.success) {
              status.textContent = "¡Mensaje enviado! Te responderemos pronto.";
              status.style.color = "#4ade80";
              status.style.display = "block";
              form.reset();
            } else {
              throw new Error("no success flag");
            }
          } catch (err) {
            console.error("[Contact] Error:", err);
            status.textContent = "Algo salió mal. Intenta de nuevo o escríbenos a support@smartloadsolution.com.";
            status.style.color = "#f87171";
            status.style.display = "block";
          } finally {
            btn.disabled = false;
            btnText.textContent = originalText;
          }
        });
      });
    })();
  </script>
```

- [ ] **Step 4: Manual verification**

This can't be unit-tested (it's a real Cloud Function call over the network). Verify locally:

1. Serve `public/` locally (e.g. `npx http-server public -p 8090`).
2. Open `http://localhost:8090/contact.html` in a browser, open devtools console.
3. Fill the form with a real-looking test message and submit.
4. Expect: success message shown, form clears, no console errors.
5. Check the Firebase Console → Firestore → `mail` collection for a new document addressed to `support@smartloadsolution.com` with the test content.
6. Delete that test document from Firestore afterward (Console → Firestore → mail → delete the doc) so it doesn't get processed by the trigger-email extension and actually sent.

- [ ] **Step 5: Commit**

```bash
git add public/contact.html
git commit -m "fix(contact): wire contact form to sendContactMessage, remove dead EmailJS"
```

---

## Task 5: Frontend — same fix on `en/contact.html`

**Files:**
- Modify: `public/en/contact.html`

`en/contact.html` uses the exact same element IDs as `contact.html`
(`#contactForm`, `#submitBtn`, `#submitBtnText`, `#name`, `#email`, `#subject`,
`#message`, same five `<option value="...">` values) — already confirmed by reading
the file. It does **not** currently load any Firebase SDK either.

- [ ] **Step 1: Remove the EmailJS script tag**

```bash
grep -n "emailjs" public/en/contact.html
```

Delete that `<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>` line entirely.

- [ ] **Step 2: Add the Firebase SDK scripts**

Add before the closing `</head>`:

```html
  <script defer src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script defer src="https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js"></script>
```

- [ ] **Step 3: Add a status message element and wire the submit handler**

Find (around line 218-224):

```html
            <button type="submit" id="submitBtn" class="btn-primary">
              <span id="submitBtnText" data-i18n="contact.btn_send">Send Message</span>
              <span>→</span>
            </button>

            <p class="text-center text-sm text-gray-500 mt-4" data-i18n="contact.respond_note">We respond to all messages within 48 hours.</p>
          </form>
```

Replace with:

```html
            <button type="submit" id="submitBtn" class="btn-primary">
              <span id="submitBtnText" data-i18n="contact.btn_send">Send Message</span>
              <span>→</span>
            </button>
            <p id="contactStatus" style="display:none;margin-top:0.5rem;font-size:0.875rem;"></p>

            <p class="text-center text-sm text-gray-500 mt-4" data-i18n="contact.respond_note">We respond to all messages within 48 hours.</p>
          </form>
```

Then, right before the closing `</body>` tag, add:

```html
  <script>
    (function () {
      var firebaseConfig = {
        apiKey: "AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY",
        authDomain: "expediter-dev.firebaseapp.com",
        projectId: "expediter-dev",
        storageBucket: "expediter-dev.appspot.com",
        messagingSenderId: "447653997176",
        appId: "1:447653997176:web:4e356867bb64b488ab5b8d"
      };
      document.addEventListener("DOMContentLoaded", function () {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

        var form = document.getElementById("contactForm");
        var btn = document.getElementById("submitBtn");
        var btnText = document.getElementById("submitBtnText");
        var status = document.getElementById("contactStatus");

        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          var name = document.getElementById("name").value.trim();
          var email = document.getElementById("email").value.trim().toLowerCase();
          var subject = document.getElementById("subject").value;
          var message = document.getElementById("message").value.trim();

          btn.disabled = true;
          var originalText = btnText.textContent;
          btnText.textContent = "Sending...";
          status.style.display = "none";

          try {
            var fn = firebase.app().functions('us-central1').httpsCallable('sendContactMessage');
            var result = await fn({ name: name, email: email, subject: subject, message: message, lang: 'en' });
            if (result && result.data && result.data.success) {
              status.textContent = "Message sent! We'll get back to you soon.";
              status.style.color = "#4ade80";
              status.style.display = "block";
              form.reset();
            } else {
              throw new Error("no success flag");
            }
          } catch (err) {
            console.error("[Contact] Error:", err);
            status.textContent = "Something went wrong. Please try again or email us at support@smartloadsolution.com.";
            status.style.color = "#f87171";
            status.style.display = "block";
          } finally {
            btn.disabled = false;
            btnText.textContent = originalText;
          }
        });
      });
    })();
  </script>
```

- [ ] **Step 4: Manual verification**

Same as Task 4 Step 4, against `http://localhost:8090/en/contact.html`.

- [ ] **Step 5: Commit**

```bash
git add public/en/contact.html
git commit -m "fix(contact): wire EN contact form to sendContactMessage, remove dead EmailJS"
```

---

## Task 6: Frontend — consent checkbox on the homepage lead modal (`index.html`)

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add the checkbox to the modal form**

Find the submit button inside the SLS form (around line 1246):

```html
          <button type="submit" class="sls-submit" id="slsSubmitBtn"></button>
```

Replace with (adds a checkbox row right before the button):

```html
          <label class="sls-consent-row" style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.75rem;font-size:0.8rem;color:#9ca3af;cursor:pointer;">
            <input type="checkbox" id="slsMarketingConsent" style="margin-top:2px;flex-shrink:0;">
            <span id="slsConsentText"></span>
          </label>
          <button type="submit" class="sls-submit" id="slsSubmitBtn"></button>
```

- [ ] **Step 2: Add the checkbox copy to `SLS_TEXTS`**

Find `SLS_TEXTS` (around line 1271-1300). Add a `consentLabel` key to both `en` and `es`:

```js
    var SLS_TEXTS = {
      en: {
        badge: "🆓 Free Plan",
        headlineHtml: 'Stop guessing.<br><span class="gradient">Know your number.</span>',
        subtext: "Enter your email and create your free account. No credit card required.",
        namePlaceholder: "Your first name",
        emailPlaceholder: "Your email address",
        consentLabel: "I'd like to receive tips and updates by email (optional)",
        submitBtn: "Get Free Access →",
        privacy: "No spam. Unsubscribe anytime. Your info is safe.",
        successTitle: "You're in!",
        successText: "Taking you to create your account now...",
        successLink: "Continue to sign up →",
        errorMsg: "Something went wrong. Please try again.",
        loading: "Saving your spot..."
      },
      es: {
        badge: "🆓 Plan Gratis",
        headlineHtml: 'Deja de adivinar.<br><span class="gradient">Conoce tu número.</span>',
        subtext: "Deja tu email y crea tu cuenta gratis. Sin tarjeta de crédito.",
        namePlaceholder: "Tu nombre",
        emailPlaceholder: "Tu correo electrónico",
        consentLabel: "Quiero recibir tips y actualizaciones por email (opcional)",
        submitBtn: "Quiero Acceso Gratis →",
        privacy: "Sin spam. Cancela cuando quieras.",
        successTitle: "¡Ya estás dentro!",
        successText: "Llevándote a crear tu cuenta ahora...",
        successLink: "Ir a registrarse →",
        errorMsg: "Algo salió mal. Intenta de nuevo.",
        loading: "Guardando tu lugar..."
      }
    };
```

- [ ] **Step 3: Render the consent copy in `slsSetLang`**

Find `slsSetLang` (around line 1304-1319):

```js
    function slsSetLang(lang) {
      slsLang = lang;
      var t = SLS_TEXTS[lang];
      document.getElementById("slsBadge").textContent = t.badge;
      document.getElementById("slsModalTitle").innerHTML = t.headlineHtml;
      document.getElementById("slsSubtext").textContent = t.subtext;
      document.getElementById("slsName").placeholder = t.namePlaceholder;
      document.getElementById("slsEmail").placeholder = t.emailPlaceholder;
      document.getElementById("slsSubmitBtn").textContent = t.submitBtn;
      document.getElementById("slsPrivacy").textContent = t.privacy;
      document.getElementById("slsSuccessTitle").textContent = t.successTitle;
      document.getElementById("slsSuccessText").textContent = t.successText;
      document.getElementById("slsSuccessLink").textContent = t.successLink;
      document.getElementById("slsLangEN").classList.toggle("active", lang === "en");
      document.getElementById("slsLangES").classList.toggle("active", lang === "es");
    }
```

Add one line (`slsConsentText`) right after the `slsEmail` line:

```js
    function slsSetLang(lang) {
      slsLang = lang;
      var t = SLS_TEXTS[lang];
      document.getElementById("slsBadge").textContent = t.badge;
      document.getElementById("slsModalTitle").innerHTML = t.headlineHtml;
      document.getElementById("slsSubtext").textContent = t.subtext;
      document.getElementById("slsName").placeholder = t.namePlaceholder;
      document.getElementById("slsEmail").placeholder = t.emailPlaceholder;
      document.getElementById("slsConsentText").textContent = t.consentLabel;
      document.getElementById("slsSubmitBtn").textContent = t.submitBtn;
      document.getElementById("slsPrivacy").textContent = t.privacy;
      document.getElementById("slsSuccessTitle").textContent = t.successTitle;
      document.getElementById("slsSuccessText").textContent = t.successText;
      document.getElementById("slsSuccessLink").textContent = t.successLink;
      document.getElementById("slsLangEN").classList.toggle("active", lang === "en");
      document.getElementById("slsLangES").classList.toggle("active", lang === "es");
    }
```

- [ ] **Step 4: Gate the Brevo call on the checkbox in `slsSubmitForm`**

Find `slsSubmitForm` (around line 1456-1491):

```js
    async function slsSubmitForm(e) {
      e.preventDefault();
      var name = document.getElementById("slsName").value.trim();
      var email = document.getElementById("slsEmail").value.trim().toLowerCase();
      var btn = document.getElementById("slsSubmitBtn");
      var errDiv = document.getElementById("slsErrorMsg");
      var t = SLS_TEXTS[slsLang];
      if (!name || !email) return;
      btn.disabled = true;
      btn.textContent = t.loading;
      errDiv.style.display = "none";
      var utms = slsStoredUTMs();
      var lead = {
        name: name,
        email: email,
        language: slsLang,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        landing_page: utms.landing_page,
        referrer: utms.referrer,
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
      };
      var results = await Promise.all([slsSaveFirestore(lead), slsSaveBrevo(name, email, utms)]);
      if (results[0] || results[1]) {
        document.getElementById("slsFormContent").style.display = "none";
        document.getElementById("slsSuccess").style.display = "block";
        setTimeout(function () { window.location.href = SLS_CONFIG.redirectUrl; }, 3000);
      } else {
        errDiv.textContent = t.errorMsg;
        errDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = t.submitBtn;
      }
    }
```

Replace the lead-object + Promise.all lines with:

```js
    async function slsSubmitForm(e) {
      e.preventDefault();
      var name = document.getElementById("slsName").value.trim();
      var email = document.getElementById("slsEmail").value.trim().toLowerCase();
      var marketingConsent = document.getElementById("slsMarketingConsent").checked;
      var btn = document.getElementById("slsSubmitBtn");
      var errDiv = document.getElementById("slsErrorMsg");
      var t = SLS_TEXTS[slsLang];
      if (!name || !email) return;
      btn.disabled = true;
      btn.textContent = t.loading;
      errDiv.style.display = "none";
      var utms = slsStoredUTMs();
      var lead = {
        name: name,
        email: email,
        language: slsLang,
        marketingConsent: marketingConsent,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        landing_page: utms.landing_page,
        referrer: utms.referrer,
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
      };
      var tasks = [slsSaveFirestore(lead)];
      if (marketingConsent) tasks.push(slsSaveBrevo(name, email, utms));
      var results = await Promise.all(tasks);
      if (results[0] || results[1]) {
        document.getElementById("slsFormContent").style.display = "none";
        document.getElementById("slsSuccess").style.display = "block";
        setTimeout(function () { window.location.href = SLS_CONFIG.redirectUrl; }, 3000);
      } else {
        errDiv.textContent = t.errorMsg;
        errDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = t.submitBtn;
      }
    }
```

(`results[0]` is always the Firestore result now; `results[1]` only exists when consent was given — `||` still correctly treats the submission as successful whenever the Firestore write succeeds, whether or not Brevo was called.)

- [ ] **Step 5: Manual verification**

1. Serve `public/` locally, open `http://localhost:8090/index.html`.
2. Open the lead modal (hero CTA), fill name + email, leave the new checkbox **unchecked**, submit.
3. Expect: success screen shown; in devtools Network tab, confirm no request was made to the `subscribeLead` callable (search for `subscribeLead` in the request list — should be absent).
4. Reopen the modal (reload page), fill again, **check** the checkbox, submit.
5. Expect: success screen shown; this time a `subscribeLead` request IS present in the Network tab.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat(leads): add marketing-consent checkbox, gate Brevo signup on opt-in"
```

---

## Task 7: Frontend — same consent checkbox on `en/index.html`

**Files:**
- Modify: `public/en/index.html`

`en/index.html`'s SLS modal is structurally identical to `index.html`'s (same
`SLS_TEXTS` shape, same `slsSetLang`/`slsSubmitForm` bodies, just `slsLang = "en"`
as the default instead of `"es"`) — already confirmed by reading the file.

- [ ] **Step 1: Add the checkbox to the modal form**

Find (around line 1414):

```html
          <button type="submit" class="sls-submit" id="slsSubmitBtn"></button>
```

Replace with:

```html
          <label class="sls-consent-row" style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.75rem;font-size:0.8rem;color:#9ca3af;cursor:pointer;">
            <input type="checkbox" id="slsMarketingConsent" style="margin-top:2px;flex-shrink:0;">
            <span id="slsConsentText"></span>
          </label>
          <button type="submit" class="sls-submit" id="slsSubmitBtn"></button>
```

- [ ] **Step 2: Add `consentLabel` to `SLS_TEXTS`**

Find (around line 1436-1465):

```js
    var SLS_TEXTS = {
      en: {
        badge: "🆓 Free Plan",
        headlineHtml: 'Stop guessing.<br><span class="gradient">Know your number.</span>',
        subtext: "Enter your email and create your free account. No credit card required.",
        namePlaceholder: "Your first name",
        emailPlaceholder: "Your email address",
        submitBtn: "Get Free Access →",
        privacy: "No spam. Unsubscribe anytime. Your info is safe.",
        successTitle: "You're in!",
        successText: "Taking you to create your account now...",
        successLink: "Continue to sign up →",
        errorMsg: "Something went wrong. Please try again.",
        loading: "Saving your spot..."
      },
      es: {
        badge: "🆓 Plan Gratis",
        headlineHtml: 'Deja de adivinar.<br><span class="gradient">Conoce tu número.</span>',
        subtext: "Deja tu email y crea tu cuenta gratis. Sin tarjeta de crédito.",
        namePlaceholder: "Tu nombre",
        emailPlaceholder: "Tu correo electrónico",
        submitBtn: "Quiero Acceso Gratis →",
        privacy: "Sin spam. Cancela cuando quieras.",
        successTitle: "¡Ya estás dentro!",
        successText: "Llevándote a crear tu cuenta ahora...",
        successLink: "Ir a registrarse →",
        errorMsg: "Algo salió mal. Intenta de nuevo.",
        loading: "Guardando tu lugar..."
      }
    };
```

Replace with:

```js
    var SLS_TEXTS = {
      en: {
        badge: "🆓 Free Plan",
        headlineHtml: 'Stop guessing.<br><span class="gradient">Know your number.</span>',
        subtext: "Enter your email and create your free account. No credit card required.",
        namePlaceholder: "Your first name",
        emailPlaceholder: "Your email address",
        consentLabel: "I'd like to receive tips and updates by email (optional)",
        submitBtn: "Get Free Access →",
        privacy: "No spam. Unsubscribe anytime. Your info is safe.",
        successTitle: "You're in!",
        successText: "Taking you to create your account now...",
        successLink: "Continue to sign up →",
        errorMsg: "Something went wrong. Please try again.",
        loading: "Saving your spot..."
      },
      es: {
        badge: "🆓 Plan Gratis",
        headlineHtml: 'Deja de adivinar.<br><span class="gradient">Conoce tu número.</span>',
        subtext: "Deja tu email y crea tu cuenta gratis. Sin tarjeta de crédito.",
        namePlaceholder: "Tu nombre",
        emailPlaceholder: "Tu correo electrónico",
        consentLabel: "Quiero recibir tips y actualizaciones por email (opcional)",
        submitBtn: "Quiero Acceso Gratis →",
        privacy: "Sin spam. Cancela cuando quieras.",
        successTitle: "¡Ya estás dentro!",
        successText: "Llevándote a crear tu cuenta ahora...",
        successLink: "Ir a registrarse →",
        errorMsg: "Algo salió mal. Intenta de nuevo.",
        loading: "Guardando tu lugar..."
      }
    };
```

- [ ] **Step 3: Render the consent copy in `slsSetLang`**

Find (around line 1469-1484):

```js
    function slsSetLang(lang) {
      slsLang = lang;
      var t = SLS_TEXTS[lang];
      document.getElementById("slsBadge").textContent = t.badge;
      document.getElementById("slsModalTitle").innerHTML = t.headlineHtml;
      document.getElementById("slsSubtext").textContent = t.subtext;
      document.getElementById("slsName").placeholder = t.namePlaceholder;
      document.getElementById("slsEmail").placeholder = t.emailPlaceholder;
      document.getElementById("slsSubmitBtn").textContent = t.submitBtn;
      document.getElementById("slsPrivacy").textContent = t.privacy;
      document.getElementById("slsSuccessTitle").textContent = t.successTitle;
      document.getElementById("slsSuccessText").textContent = t.successText;
      document.getElementById("slsSuccessLink").textContent = t.successLink;
      document.getElementById("slsLangEN").classList.toggle("active", lang === "en");
      document.getElementById("slsLangES").classList.toggle("active", lang === "es");
    }
```

Replace with:

```js
    function slsSetLang(lang) {
      slsLang = lang;
      var t = SLS_TEXTS[lang];
      document.getElementById("slsBadge").textContent = t.badge;
      document.getElementById("slsModalTitle").innerHTML = t.headlineHtml;
      document.getElementById("slsSubtext").textContent = t.subtext;
      document.getElementById("slsName").placeholder = t.namePlaceholder;
      document.getElementById("slsEmail").placeholder = t.emailPlaceholder;
      document.getElementById("slsConsentText").textContent = t.consentLabel;
      document.getElementById("slsSubmitBtn").textContent = t.submitBtn;
      document.getElementById("slsPrivacy").textContent = t.privacy;
      document.getElementById("slsSuccessTitle").textContent = t.successTitle;
      document.getElementById("slsSuccessText").textContent = t.successText;
      document.getElementById("slsSuccessLink").textContent = t.successLink;
      document.getElementById("slsLangEN").classList.toggle("active", lang === "en");
      document.getElementById("slsLangES").classList.toggle("active", lang === "es");
    }
```

- [ ] **Step 4: Gate the Brevo call in `slsSubmitForm`**

Find (around line 1613-1648):

```js
    async function slsSubmitForm(e) {
      e.preventDefault();
      var name = document.getElementById("slsName").value.trim();
      var email = document.getElementById("slsEmail").value.trim().toLowerCase();
      var btn = document.getElementById("slsSubmitBtn");
      var errDiv = document.getElementById("slsErrorMsg");
      var t = SLS_TEXTS[slsLang];
      if (!name || !email) return;
      btn.disabled = true;
      btn.textContent = t.loading;
      errDiv.style.display = "none";
      var utms = slsStoredUTMs();
      var lead = {
        name: name,
        email: email,
        language: slsLang,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        landing_page: utms.landing_page,
        referrer: utms.referrer,
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
      };
      var results = await Promise.all([slsSaveFirestore(lead), slsSaveBrevo(name, email, utms)]);
      if (results[0] || results[1]) {
        document.getElementById("slsFormContent").style.display = "none";
        document.getElementById("slsSuccess").style.display = "block";
        setTimeout(function () { window.location.href = SLS_CONFIG.redirectUrl; }, 3000);
      } else {
        errDiv.textContent = t.errorMsg;
        errDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = t.submitBtn;
      }
    }
```

Replace with:

```js
    async function slsSubmitForm(e) {
      e.preventDefault();
      var name = document.getElementById("slsName").value.trim();
      var email = document.getElementById("slsEmail").value.trim().toLowerCase();
      var marketingConsent = document.getElementById("slsMarketingConsent").checked;
      var btn = document.getElementById("slsSubmitBtn");
      var errDiv = document.getElementById("slsErrorMsg");
      var t = SLS_TEXTS[slsLang];
      if (!name || !email) return;
      btn.disabled = true;
      btn.textContent = t.loading;
      errDiv.style.display = "none";
      var utms = slsStoredUTMs();
      var lead = {
        name: name,
        email: email,
        language: slsLang,
        marketingConsent: marketingConsent,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        landing_page: utms.landing_page,
        referrer: utms.referrer,
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
      };
      var tasks = [slsSaveFirestore(lead)];
      if (marketingConsent) tasks.push(slsSaveBrevo(name, email, utms));
      var results = await Promise.all(tasks);
      if (results[0] || results[1]) {
        document.getElementById("slsFormContent").style.display = "none";
        document.getElementById("slsSuccess").style.display = "block";
        setTimeout(function () { window.location.href = SLS_CONFIG.redirectUrl; }, 3000);
      } else {
        errDiv.textContent = t.errorMsg;
        errDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = t.submitBtn;
      }
    }
```

- [ ] **Step 5: Manual verification**

Same as Task 6 Step 5, against `http://localhost:8090/en/index.html`.

- [ ] **Step 6: Commit**

```bash
git add public/en/index.html
git commit -m "feat(leads): add marketing-consent checkbox to EN homepage modal"
```

---

## Task 8: Frontend — consent checkbox on the RPM calculator lead form

**Files:**
- Modify: `public/herramientas/calculadora-rpm.html`

This form's field IDs and submit logic are named differently from the SLS modal
(`leadName`, `leadEmail`, `leadSubmit`, `submitLead()`, `saveBrevo()` — not `sls*`).

- [ ] **Step 1: Add a checkbox to the form HTML**

Find (around line 374-384):

```html
      <div id="leadFormContent" class="max-w-md mx-auto">
        <div class="flex flex-col gap-3">
          <input type="text" id="leadName" class="calc-input" placeholder="Tu nombre" autocomplete="given-name" maxlength="50">
          <input type="email" id="leadEmail" class="calc-input" placeholder="Tu correo electrónico" autocomplete="email">
          <div id="leadError" class="text-sm text-center hidden" style="color: var(--rojo);"></div>
          <button id="leadSubmit" class="w-full bg-gradient-to-r from-cyan-400 to-orange-500 hover:from-cyan-500 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg border border-white/10 transform hover:-translate-y-0.5 transition duration-300 text-lg">
            Quiero Acceso Gratis →
          </button>
        </div>
        <p class="text-xs text-gray-600 text-center mt-3">Sin spam. Cancela cuando quieras.</p>
      </div>
```

Replace with (adds the checkbox between the error div and the submit button):

```html
      <div id="leadFormContent" class="max-w-md mx-auto">
        <div class="flex flex-col gap-3">
          <input type="text" id="leadName" class="calc-input" placeholder="Tu nombre" autocomplete="given-name" maxlength="50">
          <input type="email" id="leadEmail" class="calc-input" placeholder="Tu correo electrónico" autocomplete="email">
          <div id="leadError" class="text-sm text-center hidden" style="color: var(--rojo);"></div>
          <label style="display:flex;align-items:flex-start;gap:0.5rem;font-size:0.8rem;color:#9ca3af;cursor:pointer;">
            <input type="checkbox" id="leadMarketingConsent" style="margin-top:2px;flex-shrink:0;">
            <span>Quiero recibir tips y actualizaciones por email (opcional)</span>
          </label>
          <button id="leadSubmit" class="w-full bg-gradient-to-r from-cyan-400 to-orange-500 hover:from-cyan-500 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg border border-white/10 transform hover:-translate-y-0.5 transition duration-300 text-lg">
            Quiero Acceso Gratis →
          </button>
        </div>
        <p class="text-xs text-gray-600 text-center mt-3">Sin spam. Cancela cuando quieras.</p>
      </div>
```

- [ ] **Step 2: Gate the Brevo call in `submitLead`**

Find (around line 642-689):

```js
      // ── Submit ──
      async function submitLead() {
        var name = document.getElementById("leadName").value.trim();
        var email = document.getElementById("leadEmail").value.trim().toLowerCase();
        var btn = document.getElementById("leadSubmit");
        var errDiv = document.getElementById("leadError");

        if (!name || !email) {
          errDiv.textContent = "Escribe tu nombre y tu correo.";
          errDiv.classList.remove("hidden");
          return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          errDiv.textContent = "Ese correo no se ve válido. Revísalo.";
          errDiv.classList.remove("hidden");
          return;
        }

        btn.disabled = true;
        btn.textContent = "Guardando tu lugar...";
        errDiv.classList.add("hidden");

        var utms = storedUTMs();
        var lead = {
          name: name,
          email: email,
          language: "es",
          utm_source: utms.utm_source,
          utm_medium: utms.utm_medium,
          utm_campaign: utms.utm_campaign,
          utm_content: utms.utm_content,
          landing_page: utms.landing_page,
          referrer: utms.referrer,
          device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
        };

        var results = await Promise.all([saveFirestore(lead), saveBrevo(name, email, utms)]);
        if (results[0] || results[1]) {
          document.getElementById("leadFormContent").style.display = "none";
          document.getElementById("leadSuccess").classList.remove("hidden");
          setTimeout(function () { window.location.href = LEAD_CONFIG.redirectUrl; }, 3000);
        } else {
          errDiv.textContent = "Algo salió mal. Intenta de nuevo.";
          errDiv.classList.remove("hidden");
          btn.disabled = false;
          btn.textContent = "Quiero Acceso Gratis →";
        }
      }
```

Replace with:

```js
      // ── Submit ──
      async function submitLead() {
        var name = document.getElementById("leadName").value.trim();
        var email = document.getElementById("leadEmail").value.trim().toLowerCase();
        var marketingConsent = document.getElementById("leadMarketingConsent").checked;
        var btn = document.getElementById("leadSubmit");
        var errDiv = document.getElementById("leadError");

        if (!name || !email) {
          errDiv.textContent = "Escribe tu nombre y tu correo.";
          errDiv.classList.remove("hidden");
          return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          errDiv.textContent = "Ese correo no se ve válido. Revísalo.";
          errDiv.classList.remove("hidden");
          return;
        }

        btn.disabled = true;
        btn.textContent = "Guardando tu lugar...";
        errDiv.classList.add("hidden");

        var utms = storedUTMs();
        var lead = {
          name: name,
          email: email,
          language: "es",
          marketingConsent: marketingConsent,
          utm_source: utms.utm_source,
          utm_medium: utms.utm_medium,
          utm_campaign: utms.utm_campaign,
          utm_content: utms.utm_content,
          landing_page: utms.landing_page,
          referrer: utms.referrer,
          device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
        };

        var tasks = [saveFirestore(lead)];
        if (marketingConsent) tasks.push(saveBrevo(name, email, utms));
        var results = await Promise.all(tasks);
        if (results[0] || results[1]) {
          document.getElementById("leadFormContent").style.display = "none";
          document.getElementById("leadSuccess").classList.remove("hidden");
          setTimeout(function () { window.location.href = LEAD_CONFIG.redirectUrl; }, 3000);
        } else {
          errDiv.textContent = "Algo salió mal. Intenta de nuevo.";
          errDiv.classList.remove("hidden");
          btn.disabled = false;
          btn.textContent = "Quiero Acceso Gratis →";
        }
      }
```

- [ ] **Step 3: Manual verification**

Same procedure as Task 6 Step 5, against `http://localhost:8090/herramientas/calculadora-rpm.html`.

- [ ] **Step 4: Commit**

```bash
git add public/herramientas/calculadora-rpm.html
git commit -m "feat(leads): add marketing-consent checkbox to RPM calculator lead form"
```

---

## Task 9: Remove `user_email` from GA4 user properties

**Files:**
- Modify: `public/js/analytics-manager.js:230-231`

- [ ] **Step 1: Delete the PII line**

Find (around line 229-232):

```js
            if (user) {
                window.analyticsManager.init();

                // Set user properties
                window.analyticsManager.setUserProperty('user_id', user.uid);
                window.analyticsManager.setUserProperty('user_email', user.email);
            }
```

Replace with:

```js
            if (user) {
                window.analyticsManager.init();

                // Set user properties (user_id only — GA4 ToS prohibit sending
                // directly-identifying data like raw emails as a property)
                window.analyticsManager.setUserProperty('user_id', user.uid);
            }
```

- [ ] **Step 2: Verify no other call site sends email-like data to GA4**

```bash
grep -n "setUserProperty\|gtag('set'" public/js/*.js public/*.html
```

Confirm every remaining call passes a non-PII value (uid, plan name, boolean flags, etc.) — if another one is found sending an email or name, apply the same fix.

- [ ] **Step 3: Commit**

```bash
git add public/js/analytics-manager.js
git commit -m "fix(privacy): stop sending user_email to GA4 as a user property"
```

---

## Task 10: `privacy.html` (ES) — name Brevo

**Files:**
- Modify: `public/privacy.html`
- Modify: `public/js/i18n/es.json`

Section 3 ("Compartir Información") is a 3-item list (`privacy.sec3_li1` through
`privacy.sec3_li3`), each rendered via `data-i18n-html` from a matching key in
`public/js/i18n/es.json`. Both files already confirmed by reading them — there are
**two** unrelated `sec3_li1`/`li2`/`li3` key sets in `es.json` (one under `refund`,
one under `privacy`); the ones to edit are the **privacy** ones, around line
1561-1563 (`"<strong>Con tu Consentimiento:</strong> ..."` is the last of the three).

- [ ] **Step 1: Add the new list item to `privacy.html`**

Find (around line 202-207):

```html
          <p class="text-gray-300 leading-relaxed mb-4" data-i18n="privacy.sec3_intro">Solo compartimos información con:</p>
          <ul class="list-disc ml-6 text-gray-300 space-y-2">
            <li data-i18n-html="privacy.sec3_li1"><strong>Proveedores de Servicio:</strong> Firebase (Google) para autenticación y base de datos</li>
            <li data-i18n-html="privacy.sec3_li2"><strong>Cumplimiento Legal:</strong> Si es requerido por ley o para proteger nuestros derechos</li>
            <li data-i18n-html="privacy.sec3_li3"><strong>Con tu Consentimiento:</strong> En cualquier otra circunstancia con tu autorización explícita</li>
```

Replace with (adds a fourth `<li>`, keep whatever closing `</ul>` and following markup already exists unchanged):

```html
          <p class="text-gray-300 leading-relaxed mb-4" data-i18n="privacy.sec3_intro">Solo compartimos información con:</p>
          <ul class="list-disc ml-6 text-gray-300 space-y-2">
            <li data-i18n-html="privacy.sec3_li1"><strong>Proveedores de Servicio:</strong> Firebase (Google) para autenticación y base de datos</li>
            <li data-i18n-html="privacy.sec3_li2"><strong>Cumplimiento Legal:</strong> Si es requerido por ley o para proteger nuestros derechos</li>
            <li data-i18n-html="privacy.sec3_li3"><strong>Con tu Consentimiento:</strong> En cualquier otra circunstancia con tu autorización explícita</li>
            <li data-i18n-html="privacy.sec3_li4"><strong>Proveedor de Email Marketing:</strong> Si aceptas recibir novedades por email al registrarte, compartimos tu nombre y correo con Brevo para poder enviártelas. Puedes darte de baja en cualquier momento desde el enlace en cualquier email que recibas</li>
```

- [ ] **Step 2: Add the matching i18n key**

In `public/js/i18n/es.json`, find the **privacy** section's `sec3_li3` (around line
1563 — verify it's the one right after `"sec3_banner": "✅ NO vendemos..."` and
`"sec3_intro": "Solo compartimos información con:"`, not the unrelated `refund`
one around line 1446):

```json
    "sec3_li3": "<strong>Con tu Consentimiento:</strong> En cualquier otra circunstancia con tu autorización explícita",
```

Add right after it:

```json
    "sec3_li3": "<strong>Con tu Consentimiento:</strong> En cualquier otra circunstancia con tu autorización explícita",
    "sec3_li4": "<strong>Proveedor de Email Marketing:</strong> Si aceptas recibir novedades por email al registrarte, compartimos tu nombre y correo con Brevo para poder enviártelas. Puedes darte de baja en cualquier momento desde el enlace en cualquier email que recibas",
```

(Keep the trailing comma on `sec3_li3` since it's no longer the last key in the object; check whatever key currently follows it still has *its* comma too — don't break the JSON.)

- [ ] **Step 3: Commit**

```bash
git add public/privacy.html public/js/i18n/es.json
git commit -m "docs(privacy): name Brevo as a third-party data processor"
```

---

## Task 11: `en/privacy.html` — same disclosure in English

**Files:**
- Modify: `public/en/privacy.html`
- Modify: `public/js/i18n/en.json`

Same structure as Task 10 — confirmed `en/privacy.html` uses the identical
`data-i18n-html="privacy.sec3_li1"` through `li3` pattern, and `en.json`'s **privacy**
`sec3_li3` (around line 1537, distinct from the unrelated `refund` one around 1420)
reads `"<strong>With Your Consent:</strong> In any other circumstances with your explicit authorization"`.

- [ ] **Step 1: Add the new list item to `en/privacy.html`**

```bash
grep -n 'sec3_li3\|sec3_intro' public/en/privacy.html
```

Add a fourth `<li>` right after the `sec3_li3` one, matching Task 10 Step 1's
pattern exactly:

```html
            <li data-i18n-html="privacy.sec3_li4"><strong>Email Marketing Provider:</strong> If you opt in to receive updates by email when you sign up, we share your name and email with Brevo so we can send them. You can unsubscribe at any time via the link in any email you receive</li>
```

- [ ] **Step 2: Add the matching i18n key**

In `public/js/i18n/en.json`, find the **privacy** section's `sec3_li3` (around line
1537 — verify it's next to `"sec3_banner"` / `"sec3_intro"`, not the `refund` one
around line 1419):

```json
    "sec3_li3": "<strong>With Your Consent:</strong> In any other circumstances with your explicit authorization",
```

Add right after it:

```json
    "sec3_li3": "<strong>With Your Consent:</strong> In any other circumstances with your explicit authorization",
    "sec3_li4": "<strong>Email Marketing Provider:</strong> If you opt in to receive updates by email when you sign up, we share your name and email with Brevo so we can send them. You can unsubscribe at any time via the link in any email you receive",
```

- [ ] **Step 3: Commit**

```bash
git add public/en/privacy.html public/js/i18n/en.json
git commit -m "docs(privacy): add EN translation for Brevo disclosure"
```

---

## Task 12: ~~Manual — confirm the transactional-email provider~~ — DONE (2026-08-23)

Confirmed via `firebase ext:list` + `firebase ext:export`: the installed extension is
`firebase/firestore-send-email@0.2.6` (instance ID `firestore-send-email`), ACTIVE
since 2026-03-15, configured with `AUTH_TYPE=UsernamePassword` over an SMTP relay —
**Brevo again** (`smtp-relay.brevo.com:587`, a separate SMTP credential from the
`BREVO_API_KEY` used by `subscribeLead`/`sendContactMessage`). `DEFAULT_FROM` is
`Smart Load Solution <noreply@smartloadsolution.com>`.

So the same third party (Brevo) handles both marketing-list signup *and*
transactional email delivery, via two different credentials. The Brevo disclosure
copy in Tasks 10-11 already covers this correctly — no separate "unknown provider"
placeholder needed, and no additional privacy-policy edit beyond what Tasks 10-11
already do.

**Note on `firebase ext:export`:** running it writes the live SMTP password to
`extensions/firestore-send-email.env` in plaintext on disk. That directory was not
previously in `.gitignore` — added `extensions/*.env` and `extensions/*.env.local`
to `.gitignore` immediately (2026-08-23, before this task, not part of the numbered
plan below) so this can never be accidentally committed. Don't run `ext:export`
again without checking `.gitignore` still covers it first.

**To verify actual delivery (not just configuration)**, check Brevo's dashboard →
Transactional → Statistics/Logs for send history and bounces — that's outside this
repo, Ricardo's own follow-up, not a code task.

---

## Task 13: Deploy and verify end-to-end

**Files:** none (deploy + verification only)

- [ ] **Step 1: Deploy hosting**

```bash
npx firebase deploy --only hosting
```

Expected: `Deploy complete!`

- [ ] **Step 2: Verify Contact form against production**

Open `https://smartloadsolution.com/contact.html`, submit a real test message, confirm the success message appears. Check Firestore Console `mail` collection for the new doc, confirm it was actually delivered to the `support@smartloadsolution.com` inbox, then note in Task 12 whichever provider you found actually completed the send.

- [ ] **Step 3: Verify the consent checkbox against production**

Open `https://smartloadsolution.com/`, open the lead modal, submit once with the checkbox unchecked and once checked (two different test emails), confirm via the Network tab that `subscribeLead` only fires on the checked submission — same check as Task 6 Step 5, now against the live site.

- [ ] **Step 4: Verify no GA4 PII regression**

Sign in to `https://smartloadsolution.com/app.html` with a test account, open GA4's DebugView (or Firebase Console → Analytics → DebugView) if available, confirm no `user_email` property appears on any event.
