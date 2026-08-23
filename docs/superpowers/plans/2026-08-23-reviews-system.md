# Reviews System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically ask real, engaged users for a Google review at the right moment, and have a homepage section ready to display real reviews once they exist.

**Architecture:** A new scheduled Cloud Function `requestReviews` (same `onSchedule` pattern already used by `lexDailyAlerts`) runs daily, finds users with 10+ historical loads calculated and a 7+ day-old account who haven't been asked yet, and writes a review-request email to the existing Firestore `mail` collection. The homepage gets a hidden testimonials section with obvious placeholder text, ready to populate with real quotes later — never live with fake content.

**Tech Stack:** Firebase Cloud Functions v2 (`onSchedule`), Firestore Admin SDK (count aggregation query), same `mail` collection email pattern already in use.

**Reference spec:** `docs/superpowers/specs/2026-08-23-reviews-system-design.md`

**⚠️ External blocker:** Task 4 (activation) needs a real Google Business Profile review link that only Ricardo can create (Task 3 is his manual step, not code). Tasks 1-2 can be built and tested now with a placeholder link; the scheduled function is **not deployed active** until Task 4.

---

## Task 1: Backend — write the failing test for `requestReviews`

**Files:**
- Create: `functions/test-requestReviews.js`

Follows the same mocked-Firestore + intercepted-`require` pattern as `functions/test-createLoad.js` and `functions/test-sendContactMessage.js`.

- [ ] **Step 1: Write the complete test file**

Create `functions/test-requestReviews.js`:

```js
/**
 * test-requestReviews.js — Test unitario aislado de requestReviews.
 * No requiere emulador ni producción: mockea firebase-admin, firebase-functions.
 * Ejecutar: node functions/test-requestReviews.js
 */

const Module = require('module');

// ─── Mock Firestore ──────────────────────────────────────────────────────────
const STORE = { users: {}, loads: {}, mail: {} };
let _autoIdCounter = 0;

function makeUserDoc(uid) {
    return {
        id: uid,
        ref: { id: uid },
        data() { return STORE.users[uid]; },
        update(obj) { STORE.users[uid] = Object.assign({}, STORE.users[uid], obj); return Promise.resolve(); },
    };
}

const db = {
    collection(name) {
        if (name === 'users') {
            return {
                get() {
                    const docs = Object.keys(STORE.users).map(makeUserDoc);
                    return Promise.resolve({ empty: docs.length === 0, docs, forEach(cb) { docs.forEach(cb); } });
                },
            };
        }
        if (name === 'loads') {
            return {
                where(field, op, value) {
                    return {
                        count() {
                            return {
                                get() {
                                    const matching = Object.values(STORE.loads).filter(l => l[field] === value);
                                    return Promise.resolve({ data: () => ({ count: matching.length }) });
                                },
                            };
                        },
                    };
                },
            };
        }
        if (name === 'mail') {
            return {
                add(data) {
                    const id = 'auto_' + (++_autoIdCounter);
                    STORE.mail[id] = data;
                    return Promise.resolve({ id });
                },
            };
        }
        throw new Error('Unexpected collection in test: ' + name);
    },
};

const adminMock = {
    initializeApp() {},
    firestore: Object.assign(() => db, {
        Timestamp: { fromDate: (d) => ({ _seconds: Math.floor(d.getTime() / 1000) }) },
    }),
    apps: [{}],
};

// ─── Mock firebase-functions ───────────────────────────────────────────────
class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; this.details = message; }
}
const fnV2 = {
    HttpsError,
    onCall(opts, handler) { return async (request) => handler(request); },
    onRequest(opts, handler) { return { __onRequest: true }; },
    onSchedule(opts, handler) { return { __onSchedule: true, __run: handler }; },
    setGlobalOptions() {},
};
const loggerMock = { info() {}, warn() {}, error() {}, debug() {} };
class StripeMock {
    constructor() { this.subscriptions = { update: () => Promise.resolve({}), list: () => Promise.resolve({ data: [] }) }; }
}

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

const now = new Date();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

(async () => {
    // Fixtures
    STORE.users = {
        qualifies: { email: 'qualifies@example.com', createdAt: daysAgo(30), preferredLanguage: 'es' },
        too_new: { email: 'too_new@example.com', createdAt: daysAgo(2), preferredLanguage: 'es' },
        not_enough_loads: { email: 'not_enough_loads@example.com', createdAt: daysAgo(30), preferredLanguage: 'es' },
        already_asked: { email: 'already_asked@example.com', createdAt: daysAgo(30), reviewRequestSent: true, preferredLanguage: 'es' },
    };
    for (let i = 0; i < 12; i++) STORE.loads['qualifies_' + i] = { userId: 'qualifies' };
    for (let i = 0; i < 12; i++) STORE.loads['already_asked_' + i] = { userId: 'already_asked' };
    for (let i = 0; i < 12; i++) STORE.loads['too_new_' + i] = { userId: 'too_new' };
    for (let i = 0; i < 3; i++) STORE.loads['not_enough_' + i] = { userId: 'not_enough_loads' };

    section('requestReviews — corre el scheduler');
    await fns.requestReviews.__run();

    section('requestReviews — resultados');
    assert(Object.keys(STORE.mail).length === 1, 'manda exactamente 1 email (solo "qualifies" califica) (' + Object.keys(STORE.mail).length + ')');
    const sentMail = Object.values(STORE.mail)[0];
    assert(JSON.stringify(sentMail.to) === JSON.stringify(['qualifies@example.com']), 'el email va al usuario que califica');
    assert(STORE.users.qualifies.reviewRequestSent === true, 'marca reviewRequestSent en el usuario que califica');
    assert(!STORE.users.too_new.reviewRequestSent, 'NO marca a un usuario con cuenta de menos de 7 dias');
    assert(!STORE.users.not_enough_loads.reviewRequestSent, 'NO marca a un usuario con menos de 10 cargas');
    assert(STORE.users.already_asked.reviewRequestSent === true, 'un usuario ya pedido sigue marcado (no se le vuelve a mandar)');

    section('requestReviews — no manda dos veces si corre otra vez');
    await fns.requestReviews.__run();
    assert(Object.keys(STORE.mail).length === 1, 'correr el scheduler de nuevo no manda un segundo email al mismo usuario');

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node functions/test-requestReviews.js`
Expected: FAIL with `TypeError: Cannot read properties of undefined (reading '__run')` (the function doesn't exist yet)

---

## Task 2: Backend — implement `requestReviews`

**Files:**
- Modify: `functions/index.js` (add after `sendContactMessage`, around line 1200)

- [ ] **Step 1: Add the function**

Add after the closing `);` of `exports.sendContactMessage`:

```js
// ============================================================
// requestReviews — pide reviews de Google a usuarios reales y
// activos (OCULTO). Corre 1x/dia, mismo patron que lexDailyAlerts.
// (c) 2026 SmartLoad Solution - Ricardo Galan.
// ============================================================
// ⚠️ Placeholder hasta que exista el Google Business Profile real
// (docs/superpowers/specs/2026-08-23-reviews-system-design.md, Fase 1).
// NO desplegar esta funcion como schedule activo hasta reemplazar esto.
const GOOGLE_REVIEW_LINK = 'https://g.page/r/PLACEHOLDER/review';

const REVIEW_MIN_LOADS = 10;
const REVIEW_MIN_ACCOUNT_AGE_DAYS = 7;

exports.requestReviews = onSchedule(
    { schedule: 'every 24 hours', timeZone: 'America/Chicago', maxInstances: 1 },
    async () => {
        const now = new Date();
        const cutoffMs = now.getTime() - REVIEW_MIN_ACCOUNT_AGE_DAYS * 86400000;

        const usersSnap = await db.collection('users').get();
        if (usersSnap.empty) {
            logger.info('[requestReviews] No users found.');
            return;
        }

        let sent = 0;

        for (const userDoc of usersSnap.docs) {
            const uid = userDoc.id;
            const data = userDoc.data();

            if (data.reviewRequestSent === true) continue;
            if (!data.email) continue;

            const createdAtMs = data.createdAt && data.createdAt.toDate
                ? data.createdAt.toDate().getTime()
                : new Date(data.createdAt || 0).getTime();
            if (!createdAtMs || createdAtMs > cutoffMs) continue;

            try {
                const loadsCountSnap = await db.collection('loads')
                    .where('userId', '==', uid)
                    .count()
                    .get();
                const totalLoads = loadsCountSnap.data().count;
                if (totalLoads < REVIEW_MIN_LOADS) continue;

                const lang = data.preferredLanguage === 'en' ? 'en' : 'es';
                const subject = lang === 'en'
                    ? 'Quick favor? (30 seconds)'
                    : '¿Un favor rápido? (30 segundos)';
                const html = lang === 'en'
                    ? `<div style="font-family:Arial,sans-serif;max-width:600px;">
                         <p>Hey! You've calculated ${totalLoads} loads with SmartLoad Solution — glad it's been useful.</p>
                         <p>Would you mind leaving a quick Google review? It takes 30 seconds and really helps other independent carriers find us.</p>
                         <p><a href="${GOOGLE_REVIEW_LINK}" style="background:#C2410C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Leave a review →</a></p>
                       </div>`
                    : `<div style="font-family:Arial,sans-serif;max-width:600px;">
                         <p>¡Hola! Ya calculaste ${totalLoads} cargas con SmartLoad Solution — nos alegra que te esté sirviendo.</p>
                         <p>¿Nos regalas una reseña rápida en Google? Toma 30 segundos y ayuda a que otros transportistas independientes nos encuentren.</p>
                         <p><a href="${GOOGLE_REVIEW_LINK}" style="background:#C2410C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Dejar una reseña →</a></p>
                       </div>`;

                await db.collection('mail').add({
                    to: [data.email],
                    message: { subject, html },
                });
                await userDoc.ref.update({ reviewRequestSent: true });
                sent++;
            } catch (e) {
                logger.error(`[requestReviews] Error procesando usuario ${uid}:`, e.message);
            }
        }

        logger.info(`[requestReviews] Emails de review enviados: ${sent}`);
    }
);
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node functions/test-requestReviews.js`
Expected: `RESULTADO: 6 pasaron, 0 fallaron` (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add functions/index.js functions/test-requestReviews.js
git commit -m "feat(functions): add requestReviews scheduled function (inactive placeholder link)"
```

**Do not deploy this function yet** — `GOOGLE_REVIEW_LINK` is a placeholder. Deploying `onSchedule` now would start sending real emails with a broken link to real users on the next daily run. Wait for Task 4.

---

## Task 3: Homepage — hidden testimonials section, ready for real content

**Files:**
- Modify: `public/index.html`
- Modify: `public/en/index.html`

- [ ] **Step 1: Find the existing testimonials section closing tag**

```bash
grep -n '<section id="testimonials"' public/index.html
```

Find where that `<section>` closes (search for the next `</section>` after that line).

- [ ] **Step 2: Add the hidden real-reviews subsection right after it**

Insert immediately after the existing testimonials `</section>` closing tag:

```html
  <!-- ⚠️ OCULTO A PROPOSITO — activar manualmente cuando haya reviews
       reales para pegar. Ver docs/superpowers/specs/2026-08-23-reviews-system-design.md.
       NUNCA reemplazar los placeholders con contenido inventado. -->
  <section id="real-reviews" class="section" style="display:none;" data-status="waiting-for-real-content">
    <div class="container">
      <h2 class="text-3xl md:text-4xl font-black mb-4 text-center">Lo Que Dicen Nuestros Usuarios</h2>
      <div class="grid md:grid-cols-3 gap-6 mt-8">
        <div class="glass-card p-6">
          <p class="text-gray-300 mb-4">"[PEGAR REVIEW REAL AQUI]"</p>
          <p class="font-semibold text-white">[Nombre real]</p>
        </div>
        <div class="glass-card p-6">
          <p class="text-gray-300 mb-4">"[PEGAR REVIEW REAL AQUI]"</p>
          <p class="font-semibold text-white">[Nombre real]</p>
        </div>
        <div class="glass-card p-6">
          <p class="text-gray-300 mb-4">"[PEGAR REVIEW REAL AQUI]"</p>
          <p class="font-semibold text-white">[Nombre real]</p>
        </div>
      </div>
      <p class="text-center mt-8">
        <a href="https://g.page/r/PLACEHOLDER/review" class="text-cyan-400 hover:underline">Ver más reseñas en Google →</a>
      </p>
    </div>
  </section>
```

- [ ] **Step 3: Same for `public/en/index.html`**

Same block, English copy:

```html
  <!-- ⚠️ HIDDEN ON PURPOSE — activate manually once real reviews exist
       to paste in. See docs/superpowers/specs/2026-08-23-reviews-system-design.md.
       NEVER replace the placeholders with invented content. -->
  <section id="real-reviews" class="section" style="display:none;" data-status="waiting-for-real-content">
    <div class="container">
      <h2 class="text-3xl md:text-4xl font-black mb-4 text-center">What Our Users Say</h2>
      <div class="grid md:grid-cols-3 gap-6 mt-8">
        <div class="glass-card p-6">
          <p class="text-gray-300 mb-4">"[PASTE REAL REVIEW HERE]"</p>
          <p class="font-semibold text-white">[Real name]</p>
        </div>
        <div class="glass-card p-6">
          <p class="text-gray-300 mb-4">"[PASTE REAL REVIEW HERE]"</p>
          <p class="font-semibold text-white">[Real name]</p>
        </div>
        <div class="glass-card p-6">
          <p class="text-gray-300 mb-4">"[PASTE REAL REVIEW HERE]"</p>
          <p class="font-semibold text-white">[Real name]</p>
        </div>
      </div>
      <p class="text-center mt-8">
        <a href="https://g.page/r/PLACEHOLDER/review" class="text-cyan-400 hover:underline">See more reviews on Google →</a>
      </p>
    </div>
  </section>
```

- [ ] **Step 4: Verify it's actually hidden**

Serve `public/` locally, open `index.html` and `en/index.html`, confirm the "Lo Que Dicen Nuestros Usuarios" / "What Our Users Say" section does **not** appear anywhere on the page (it's `display:none`) and no console errors were introduced.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/en/index.html
git commit -m "feat(homepage): add hidden real-reviews section, ready for real content"
```

---

## Task 4: Manual (Ricardo) — create the Google Business Profile

**Files:** none (external, not code)

- [ ] **Step 1:** Go to [business.google.com/create](https://business.google.com/create), create the profile as a **"Service area business"** (no public address), category "Software company" or closest match.
- [ ] **Step 2:** Complete Google's verification flow (video or postcard — may take a few days).
- [ ] **Step 3:** Once verified, get the review-request link: Google Business Profile dashboard → Home → "Get more reviews" → copy the `https://g.page/r/.../review` link.
- [ ] **Step 4:** Report the real link back — needed for Task 5.

---

## Task 5: Activation — plug in the real review link, deploy

**Files:**
- Modify: `functions/index.js`
- Modify: `public/index.html`
- Modify: `public/en/index.html`

**Blocked on Task 4.**

- [ ] **Step 1:** Replace `GOOGLE_REVIEW_LINK = 'https://g.page/r/PLACEHOLDER/review'` in `functions/index.js` with the real link from Task 4.
- [ ] **Step 2:** Replace both `https://g.page/r/PLACEHOLDER/review` hrefs in `public/index.html` and `public/en/index.html` (Task 3) with the same real link.
- [ ] **Step 3:** Run `node functions/test-requestReviews.js` again — confirm still passes (the placeholder swap shouldn't affect test logic, but re-run to be sure nothing else changed).
- [ ] **Step 4:** Commit:
  ```bash
  git add functions/index.js public/index.html public/en/index.html
  git commit -m "feat(reviews): activate real Google Business Profile review link"
  ```
- [ ] **Step 5:** Deploy the function: `npx firebase deploy --only functions:requestReviews`
- [ ] **Step 6:** Deploy hosting: `npx firebase deploy --only hosting`
- [ ] **Step 7:** Confirm live: `curl -s https://smartloadsolution.com/ | grep -o "g.page/r/[^\"']*"` should show the real link, not the placeholder.

The `#real-reviews` section stays `display:none` until Ricardo has real review text to paste in — that's a manual content edit whenever the first reviews come in, not part of this plan.
