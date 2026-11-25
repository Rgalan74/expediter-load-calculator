/**
 * SMART LOAD ACADEMY - Progress Tracking System
 * v2.0 — Firestore-backed progress (migrated from localStorage)
 */

const AcademyProgress = {
    STORAGE_KEY: 'smartload_academy_progress', // legacy fallback
    _userId: null,
    _cache: null, // in-memory cache to avoid redundant reads

    MODULES: {
        0: { lessons: 1, name: 'START HERE', time: '5 min', difficulty: 'Muy fácil' },
        1: { lessons: 5, name: 'Mentalidad & Fundamentos', time: '36 min', difficulty: 'Fácil' },
        2: { lessons: 6, name: 'Dominando los Números', time: '49 min', difficulty: 'Fácil' },
        3: { lessons: 5, name: 'Estrategia de Rutas & Zonas', time: '39 min', difficulty: 'Intermedio' },
        4: { lessons: 5, name: 'Negociación & Relaciones con Brokers', time: '43 min', difficulty: 'Intermedio', locked: true },
        5: { lessons: 5, name: 'Análisis Financiero & KPIs', time: '42 min', difficulty: 'Intermedio', locked: true },
        6: { lessons: 5, name: 'Optimización Operativa Avanzada', time: '40 min', difficulty: 'Avanzado', locked: true },
        7: { lessons: 5, name: 'Estrategias de Crecimiento Sostenible', time: '41 min', difficulty: 'Avanzado', locked: true },
        8: { lessons: 5, name: 'Sustentabilidad y Balance Vida-Trabajo', time: '41 min', difficulty: 'Avanzado', locked: true }
    },

    /**
     * Set authenticated user — must be called before init()
     */
    setUser(uid) {
        this._userId = uid;
        this._cache = null; // clear cache on user change
    },

    /**
     * Firestore document reference for this user's progress
     */
    _docRef() {
        if (!this._userId || typeof firebase === 'undefined') return null;
        return firebase.firestore()
            .collection('academyProgress')
            .doc(this._userId);
    },

    /**
     * Default progress structure
     */
    _defaultProgress() {
        const modules = {};
        for (let i = 0; i <= 8; i++) {
            modules[i] = { completed: [], current: null, quizzes: {} };
        }
        return { modules, badges: [], lastUpdate: new Date().toISOString() };
    },

    /**
     * Get progress — Firestore first, localStorage fallback
     */
    async getProgress() {
        if (this._cache) return this._cache;

        const ref = this._docRef();
        if (ref) {
            try {
                const snap = await ref.get();
                if (snap.exists) {
                    this._cache = snap.data();
                    return this._cache;
                }
                // No Firestore doc yet — check localStorage for migration
                const local = localStorage.getItem(this.STORAGE_KEY);
                if (local) {
                    const migrated = JSON.parse(local);
                    // Persist migrated data to Firestore
                    await ref.set(migrated);
                    localStorage.removeItem(this.STORAGE_KEY);
                    this._cache = migrated;
                    console.log('[ACADEMY] Progreso migrado de localStorage a Firestore ✅');
                    return this._cache;
                }
            } catch (e) {
                console.warn('[ACADEMY] Error leyendo Firestore, usando localStorage:', e);
            }
        }

        // Fallback: localStorage
        const stored = localStorage.getItem(this.STORAGE_KEY);
        this._cache = stored ? JSON.parse(stored) : this._defaultProgress();
        return this._cache;
    },

    /**
     * Save progress to Firestore (or localStorage fallback)
     */
    async saveProgress(progress) {
        progress.lastUpdate = new Date().toISOString();
        this._cache = progress;

        const ref = this._docRef();
        if (ref) {
            try {
                await ref.set(progress);
                return;
            } catch (e) {
                console.warn('[ACADEMY] Error guardando en Firestore, usando localStorage:', e);
            }
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    },

    /**
     * Initialize progress tracking (async)
     */
    async init() {
        await this.loadProgress();
        await this.updateAllUI();
    },

    async loadProgress() {
        const progress = await this.getProgress();
        console.log('📚 Academy progress loaded:', progress);
    },

    /**
     * Mark a lesson as complete
     */
    async completeLesson(moduleNum, lessonNum) {
        const progress = await this.getProgress();
        const mod = progress.modules[moduleNum];

        if (!mod.completed.includes(lessonNum)) {
            mod.completed.push(lessonNum);
            mod.completed.sort((a, b) => a - b);

            if (mod.completed.length === this.MODULES[moduleNum].lessons) {
                this.awardBadge(progress, `module_${moduleNum}_complete`);
            }

            await this.saveProgress(progress);
            await this.updateAllUI();
            console.log(`✅ Lesson ${moduleNum}-${lessonNum} completed`);
        }
    },

    async setCurrentLesson(moduleNum, lessonNum) {
        const progress = await this.getProgress();
        progress.modules[moduleNum].current = lessonNum;
        await this.saveProgress(progress);
    },

    async isLessonComplete(moduleNum, lessonNum) {
        const progress = await this.getProgress();
        return progress.modules[moduleNum].completed.includes(lessonNum);
    },

    // Quiz gate: puede fallar como máximo 1 pregunta para aprobar
    QUIZ_MAX_MISSES: 1,

    /**
     * Guarda el resultado del intento más reciente del quiz de una lección.
     * Reintentos ilimitados: cada llamada sobreescribe el intento anterior.
     */
    async recordQuizResult(moduleNum, lessonNum, score, total) {
        const progress = await this.getProgress();
        const mod = progress.modules[moduleNum];
        if (!mod.quizzes) mod.quizzes = {};

        const passed = (total - score) <= this.QUIZ_MAX_MISSES;
        mod.quizzes[lessonNum] = { passed, score, total, lastAttempt: new Date().toISOString() };

        await this.saveProgress(progress);
        return passed;
    },

    async isQuizPassed(moduleNum, lessonNum) {
        const progress = await this.getProgress();
        return !!progress.modules[moduleNum]?.quizzes?.[lessonNum]?.passed;
    },

    async getModuleProgress(moduleNum) {
        const progress = await this.getProgress();
        const completed = progress.modules[moduleNum].completed.length;
        const total = this.MODULES[moduleNum].lessons;
        return Math.round((completed / total) * 100);
    },

    async getOverallProgress() {
        const progress = await this.getProgress();
        let totalCompleted = 0;
        let totalLessons = 0;
        for (let i = 0; i <= 3; i++) {
            totalCompleted += progress.modules[i].completed.length;
            totalLessons += this.MODULES[i].lessons;
        }
        return totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
    },

    async getCompletedModulesCount() {
        const progress = await this.getProgress();
        let count = 0;
        for (let i = 0; i <= 8; i++) {
            if (progress.modules[i].completed.length === this.MODULES[i].lessons) count++;
        }
        return count;
    },

    awardBadge(progress, badgeId) {
        if (!progress.badges.includes(badgeId)) {
            progress.badges.push(badgeId);
            this.showBadgeNotification(badgeId);
        }
    },

    showBadgeNotification(badgeId) {
        const name = badgeId.replace(/_/g, ' ').toUpperCase();
        console.log(`🏆 Badge Earned: ${name}`);
        // Toast notification can be added here
    },

    async updateAllUI() {
        await this.updateOverviewStats();
        await this.updateModuleCards();
    },

    async updateOverviewStats() {
        const completedModules = await this.getCompletedModulesCount();
        const overallProgress = await this.getOverallProgress();
        const progress = await this.getProgress();

        const completedEl = document.getElementById('completedModules');
        if (completedEl) completedEl.textContent = `${completedModules}/8`;

        const progressEl = document.getElementById('overallProgress');
        if (progressEl) progressEl.textContent = `${overallProgress}%`;

        const badgesEl = document.getElementById('badgesEarned');
        if (badgesEl) badgesEl.textContent = progress.badges.length;
    },

    async updateModuleCards() {
        const progress = await this.getProgress();
        for (let i = 0; i <= 8; i++) {
            const completed = progress.modules[i].completed.length;
            const total = this.MODULES[i].lessons;
            const pct = Math.round((completed / total) * 100);

            const fillEl = document.querySelector(`.progress-fill[data-module="${i}"]`);
            if (fillEl) fillEl.style.width = `${pct}%`;

            const textEl = document.querySelector(`.progress-text[data-module="${i}"]`);
            if (textEl) {
                const label = window.i18n?.t('academy.lesson_label')?.toLowerCase() || 'lessons';
                textEl.textContent = `${completed}/${total} ${label === 'lección' ? 'lecciones' : 'lessons'}`;
            }
        }
    },

    async reset() {
        const msg = window.i18n?.currentLang === 'en' 
            ? 'Are you sure you want to reset all your progress?' 
            : '¿Estás seguro de que quieres reiniciar todo tu progreso?';
        if (confirm(msg)) {
            const fresh = this._defaultProgress();
            await this.saveProgress(fresh);
            location.reload();
        }
    }
};

// NOTE: init() is called from academy.html after setUser(uid)
window.AcademyProgress = AcademyProgress;
console.log('📚 Academy.js v2 (Firestore) loaded');

// ===============================
// ACADEMY ACCESS CONTROL v1.0
// ===============================
const AcademyAccess = {

    async checkAndUnlock() {
        if (typeof firebase === 'undefined') {
            await this._loadFirebase();
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (window.AcademyProgress) {
                window.AcademyProgress.setUser(user ? user.uid : null);
            }
            if (!user) { AcademyGate.resolve(false, false); return; }
            try {
                const doc = await firebase.firestore()
                    .collection('users').doc(user.uid).get();
                const data = doc.data() || {};
                const planId = (data.role === 'admin') ? 'admin' : (data.plan || 'free');

                const isPro = ['professional', 'premium', 'admin'].includes(planId);
                const isPremium = ['premium', 'admin'].includes(planId);

                console.log(`[ACADEMY] planId: ${planId} | pro: ${isPro} | premium: ${isPremium}`);

                AcademyGate.resolve(isPro, isPremium);
                this.unlockModuleCards(isPro, isPremium);
                if (isPro || isPremium) this.unlockPage();

            } catch (e) {
                console.warn('[ACADEMY] Error checking access:', e);
            }
        });
    },

    unlockModuleCards(isPro, isPremium) {
        const isEnglish = window.location.pathname.includes('/en/');
        const basePath = isEnglish ? '/en/academy/' : '/academy/';

        document.querySelectorAll('.module-card[data-tier]').forEach(card => {
            const tier = card.dataset.tier;
            const moduleNum = card.dataset.module;
            const hasAccess = (tier === 'pro' && (isPro || isPremium)) ||
                               (tier === 'premium' && isPremium);
            if (!hasAccess) return;

            card.classList.remove('locked');
            card.querySelectorAll('.module-badge').forEach(b => {
                b.style.display = 'none';
            });
            const overlay = card.querySelector('.locked-overlay');
            if (overlay) overlay.style.display = 'none';

            const cta = card.querySelector('a.btn-module');
            if (cta && moduleNum) {
                cta.classList.remove('locked');
                cta.href = `${basePath}module-${moduleNum}/`;
                cta.textContent = isEnglish ? 'Start →' : 'Empezar →';
            }
        });
        console.log('[ACADEMY] Module cards actualizadas segun plan ✅');
    },

    unlockPage() {
        // 1. Ocultar sección candado principal
        document.querySelectorAll('section').forEach(s => {
            if (s.closest('.al-lesson')) return; // las lecciones v2 usan AcademyGate
            if (/contenido (pro|premium|elite)|(pro|premium|elite) content/i.test(s.innerHTML)) {
                s.style.display = 'none';
                console.log('[ACADEMY] Lock section ocultada ✅');
            }
        });

        // 2. Ocultar badge header 🔒 CONTENIDO PRO
        document.querySelectorAll('div').forEach(div => {
            if (div.style.display === 'inline-block' &&
                /🔒 (contenido (pro|premium)|(pro|premium) content)/i.test(div.innerHTML)) {
                div.style.display = 'none';
                console.log('[ACADEMY] Badge header ocultado ✅');
            }
        });

        // 3. Ocultar badges 🔒 PRO/PREMIUM en lecciones individuales
        // (sin distinguir mayusculas: los indices dicen "🔒 Premium" desde PR #53)
        document.querySelectorAll('div').forEach(div => {
            const txt = (div.textContent || '').trim().toUpperCase();
            if (div.style.position === 'absolute' &&
                (txt === '🔒 PRO' || txt === '🔒 PREMIUM')) {
                div.style.display = 'none';
            }
        });

        // 4. Ocultar sección "Upgrade a PRO" al fondo
        document.querySelectorAll('div').forEach(div => {
            if (div.style.background?.includes('rgba(255, 215, 0, 0.15)') &&
                div.querySelector('a')?.textContent.includes('Upgrade')) {
                div.style.display = 'none';
            }
        });

        // 5. Restaurar estilo de botones btn-module en cards desbloqueados
        document.querySelectorAll('.module-card:not(.locked) .btn-module').forEach(btn => {
            btn.style.background = '#22D3EE'; btn.style.color = '#06222A';
            btn.style.color = '#06222A';
            btn.style.textAlign = 'center';
            btn.style.display = 'block';
            btn.style.padding = '1rem';
            btn.style.borderRadius = '0.75rem';
            btn.style.fontWeight = '700';
            btn.style.textDecoration = 'none';
        });

        console.log('[ACADEMY] Página desbloqueada ✅');
    },

    async _loadFirebase() {
        const loadScript = (src) => new Promise(resolve => {
            const s = document.createElement('script');
            s.src = src; s.onload = resolve;
            document.head.appendChild(s);
        });
        await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js');
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: "AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY",
                authDomain: "expediter-dev.firebaseapp.com",
                projectId: "expediter-dev"
            });
        }
        console.log('[ACADEMY] Firebase cargado dinámicamente ✅');
    }
};

// ===============================
// BLOQUEO SUAVE DE LECCIONES DE PAGO (aprobado 2026-11-24)
// Modulos 4-6 = Pro, 7-8 = Premium (pagina de planes y userPlans.js). La leccion 1 de cada modulo queda abierta.
// Sin el plan se ve el titulo, "Lo que vas a aprender" y la primera seccion;
// el resto se oculta y aparece un recuadro con "Ver planes". Quien paga lo ve
// todo. El plan conocido se recuerda en el dispositivo para no mostrar el
// recuadro un instante a quien ya pago.
// ===============================
const AcademyGate = {
    PLAN_KEY: 'sls_academy_plan_v1',

    _tier() {
        if (typeof MODULE_NUM === 'undefined' || typeof LESSON_NUM === 'undefined') return null;
        if (Number(LESSON_NUM) === 1) return null;
        const m = Number(MODULE_NUM);
        return m >= 7 ? 'premium' : (m >= 4 ? 'pro' : null); // planes: Pro = modulos 1-6
    },

    _hasAccess(tier, isPro, isPremium) {
        return tier === 'premium' ? !!isPremium : !!(isPro || isPremium);
    },

    _cached() {
        try { return JSON.parse(localStorage.getItem(this.PLAN_KEY) || 'null'); } catch (e) { return null; }
    },

    init() {
        const tier = this._tier();
        const lesson = document.querySelector('.al-lesson');
        if (!tier || !lesson) return;
        this._addSchema(lesson);
        const c = this._cached();
        if (c && this._hasAccess(tier, c.isPro, c.isPremium)) return; // pagado: sin parpadeo
        this.lock();
    },

    lock() {
        const tier = this._tier();
        const lesson = document.querySelector('.al-lesson');
        if (!tier || !lesson || lesson.classList.contains('al-gated')) return;
        lesson.classList.add('al-gated');
        const es = document.documentElement.lang !== 'en';
        const plan = tier === 'premium' ? 'Premium' : 'Pro';
        const plansUrl = es ? '/plans.html' : '/en/plans.html';
        const box = document.createElement('section');
        box.className = 'al-gate';
        box.id = 'alGate';
        box.innerHTML = `
            <div class="al-gate-label">🔒 ${es ? 'Lección del plan' : 'Lesson in the'} ${plan}${es ? '' : ' plan'}</div>
            <p>${es
                ? `Ya leíste el comienzo. Con el plan ${plan} ves la lección completa, sus calculadoras y el quiz, y todos los módulos de tu plan.`
                : `You have read the beginning. With the ${plan} plan you get the full lesson, its calculators and quiz, and every module in your plan.`}</p>
            <div class="al-gate-actions">
                <a class="al-btn al-btn-primary" href="${plansUrl}">${es ? 'Ver planes →' : 'See plans →'}</a>
                <a class="al-btn al-btn-ghost" href="/auth.html">${es ? 'Ya tengo el plan: iniciar sesión' : 'I have the plan: sign in'}</a>
            </div>`;
        const first = lesson.querySelector('.al-section');
        if (first) first.after(box); else lesson.appendChild(box);
    },

    unlock() {
        const lesson = document.querySelector('.al-lesson');
        if (lesson) lesson.classList.remove('al-gated');
        document.getElementById('alGate')?.remove();
    },

    resolve(isPro, isPremium) {
        try { localStorage.setItem(this.PLAN_KEY, JSON.stringify({ isPro: !!isPro, isPremium: !!isPremium })); } catch (e) { /* sin localStorage */ }
        const tier = this._tier();
        if (!tier) return;
        if (this._hasAccess(tier, isPro, isPremium)) this.unlock(); else this.lock();
    },

    // Google: contenido de suscripcion (no es "cloaking")
    _addSchema(lesson) {
        lesson.querySelectorAll('.al-section').forEach((s, i) => { if (i > 0) s.classList.add('al-pago'); });
        const ld = document.createElement('script');
        ld.type = 'application/ld+json';
        ld.textContent = JSON.stringify({
            '@context': 'https://schema.org', '@type': 'Article',
            headline: document.querySelector('.al-title')?.textContent?.trim() || document.title,
            isAccessibleForFree: false,
            hasPart: { '@type': 'WebPageElement', isAccessibleForFree: false, cssSelector: '.al-pago' }
        });
        document.head.appendChild(ld);
    }
};
window.AcademyGate = AcademyGate;

document.addEventListener('DOMContentLoaded', () => {
    AcademyGate.init();
    // Delay para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
        AcademyAccess.checkAndUnlock();
    }, 500);
});

window.AcademyAccess = AcademyAccess;
