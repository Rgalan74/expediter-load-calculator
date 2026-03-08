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
        1: { lessons: 5, name: 'Mentalidad & Fundamentos', time: '35 min', difficulty: 'Fácil' },
        2: { lessons: 5, name: 'Dominando los Números', time: '45 min', difficulty: 'Fácil' },
        3: { lessons: 5, name: 'Estrategia de Rutas', time: '40 min', difficulty: 'Intermedio' },
        4: { lessons: 5, name: 'Negociación & Rates', time: '50 min', difficulty: 'Intermedio', locked: true },
        5: { lessons: 5, name: 'Análisis Financiero', time: '45 min', difficulty: 'Intermedio', locked: true },
        6: { lessons: 5, name: 'Inteligencia con Lex AI', time: '30 min', difficulty: 'Intermedio', locked: true },
        7: { lessons: 5, name: 'Optimización Operativa', time: '35 min', difficulty: 'Fácil', locked: true },
        8: { lessons: 5, name: 'Nivel Pro', time: '60 min', difficulty: 'Avanzado', locked: true }
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
            modules[i] = { completed: [], current: null };
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
            if (textEl) textEl.textContent = `${completed}/${total} lecciones`;
        }
    },

    async reset() {
        if (confirm('¿Estás seguro de que quieres reiniciar todo tu progreso?')) {
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
            if (!user) return;
            try {
                const doc = await firebase.firestore()
                    .collection('users').doc(user.uid).get();
                const data = doc.data() || {};
                const planId = (data.role === 'admin') ? 'admin' : (data.plan || 'free');

                const isPro = ['professional', 'premium', 'admin'].includes(planId);
                const isPremium = ['premium', 'admin'].includes(planId);

                console.log(`[ACADEMY] planId: ${planId} | pro: ${isPro} | premium: ${isPremium}`);

                if (isPro || isPremium) this.unlockPage();

            } catch (e) {
                console.warn('[ACADEMY] Error checking access:', e);
            }
        });
    },

    unlockPage() {
        // 1. Ocultar sección candado principal
        document.querySelectorAll('section').forEach(s => {
            if (s.innerHTML.includes('Contenido Premium') ||
                s.innerHTML.includes('Contenido Pro') ||
                s.innerHTML.includes('CONTENIDO PRO') ||
                s.innerHTML.includes('Contenido Elite')) {
                s.style.display = 'none';
                console.log('[ACADEMY] Lock section ocultada ✅');
            }
        });

        // 2. Ocultar badge header 🔒 CONTENIDO PRO
        document.querySelectorAll('div').forEach(div => {
            if (div.style.display === 'inline-block' &&
                (div.innerHTML.includes('🔒 CONTENIDO PRO') ||
                    div.innerHTML.includes('🔒 CONTENIDO PREMIUM'))) {
                div.style.display = 'none';
                console.log('[ACADEMY] Badge header ocultado ✅');
            }
        });

        // 3. Ocultar badges 🔒 PRO/PREMIUM en lecciones individuales
        document.querySelectorAll('div').forEach(div => {
            const txt = div.textContent?.trim();
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
            btn.style.background = 'linear-gradient(90deg, #00D9FF 0%, #FF6B35 100%)';
            btn.style.color = '#ffffff';
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

document.addEventListener('DOMContentLoaded', () => {
    // Delay para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
        AcademyAccess.checkAndUnlock();
    }, 500);
});

window.AcademyAccess = AcademyAccess;
