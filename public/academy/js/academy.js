/**
 * SMART LOAD ACADEMY - Progress Tracking System
 * Tracks lesson completion, module progress, and earned badges
 */

const AcademyProgress = {
    // Storage key
    STORAGE_KEY: 'smartload_academy_progress',

    // Module configuration
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
     * Initialize progress tracking on page load
     */
    init() {
        this.loadProgress();
        this.updateAllUI();
    },

    /**
     * Get current progress from localStorage
     */
    getProgress() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }

        // Default structure
        return {
            modules: {
                0: { completed: [], current: null },
                1: { completed: [], current: null },
                2: { completed: [], current: null },
                3: { completed: [], current: null },
                4: { completed: [], current: null },
                5: { completed: [], current: null },
                6: { completed: [], current: null },
                7: { completed: [], current: null },
                8: { completed: [], current: null }
            },
            badges: [],
            lastUpdate: new Date().toISOString()
        };
    },

    /**
     * Save progress to localStorage
     */
    saveProgress(progress) {
        progress.lastUpdate = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    },

    /**
    * Mark a lesson as complete
     */
    completeLesson(moduleNum, lessonNum) {
        const progress = this.getProgress();
        const module = progress.modules[moduleNum];

        if (!module.completed.includes(lessonNum)) {
            module.completed.push(lessonNum);
            module.completed.sort((a, b) => a - b);

            // Check if module is complete
            if (module.completed.length === this.MODULES[moduleNum].lessons) {
                this.awardBadge(`module_${moduleNum}_complete`);
            }

            this.saveProgress(progress);
            this.updateAllUI();

            console.log(`✅ Lesson ${moduleNum}-${lessonNum} completed`);
        }
    },

    /**
     * Set current lesson for a module
     */
    setCurrentLesson(moduleNum, lessonNum) {
        const progress = this.getProgress();
        progress.modules[moduleNum].current = lessonNum;
        this.saveProgress(progress);
    },

    /**
     * Check if a lesson is completed
     */
    isLessonComplete(moduleNum, lessonNum) {
        const progress = this.getProgress();
        return progress.modules[moduleNum].completed.includes(lessonNum);
    },

    /**
     * Calculate module progress percentage
     */
    getModuleProgress(moduleNum) {
        const progress = this.getProgress();
        const completed = progress.modules[moduleNum].completed.length;
        const total = this.MODULES[moduleNum].lessons;
        return Math.round((completed / total) * 100);
    },

    /**
     * Calculate overall progress
     */
    getOverallProgress() {
        const progress = this.getProgress();
        let totalCompleted = 0;
        let totalLessons = 0;

        // Count all free modules (0-3) for free users
        for (let i = 0; i <= 3; i++) {
            totalCompleted += progress.modules[i].completed.length;
            totalLessons += this.MODULES[i].lessons;
        }

        return totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
    },

    /**
     * Get completed modules count
     */
    getCompletedModulesCount() {
        const progress = this.getProgress();
        let count = 0;

        for (let i = 0; i <= 8; i++) {
            if (progress.modules[i].completed.length === this.MODULES[i].lessons) {
                count++;
            }
        }

        return count;
    },

    /**
     * Award a badge
     */
    awardBadge(badgeId) {
        const progress = this.getProgress();

        if (!progress.badges.includes(badgeId)) {
            progress.badges.push(badgeId);
            this.saveProgress(progress);
            this.showBadgeNotification(badgeId);
        }
    },

    /**
     * Show badge notification
     */
    showBadgeNotification(badgeId) {
        const badgeName = badgeId.replace(/_/g, ' ').toUpperCase();
        console.log(`🏆 Badge Earned: ${badgeName}`);

        // You can implement a toast notification here
        // For now, just console log
    },

    /**
     * Update all UI elements on the page
     */
    updateAllUI() {
        this.updateOverviewStats();
        this.updateModuleCards();
    },

    /**
     * Update overview stats (homepage)
     */
    updateOverviewStats() {
        const completedModules = this.getCompletedModulesCount();
        const overallProgress = this.getOverallProgress();
        const progress = this.getProgress();

        // Update completed modules
        const completedEl = document.getElementById('completedModules');
        if (completedEl) {
            completedEl.textContent = `${completedModules}/8`;
        }

        // Update overall progress
        const progressEl = document.getElementById('overallProgress');
        if (progressEl) {
            progressEl.textContent = `${overallProgress}%`;
        }

        // Update badges
        const badgesEl = document.getElementById('badgesEarned');
        if (badgesEl) {
            badgesEl.textContent = progress.badges.length;
        }
    },

    /**
     * Update module cards with progress
     */
    updateModuleCards() {
        for (let i = 0; i <= 8; i++) {
            const moduleProgress = this.getModuleProgress(i);
            const progress = this.getProgress();
            const completed = progress.modules[i].completed.length;
            const total = this.MODULES[i].lessons;

            // Update progress bar
            const fillEl = document.querySelector(`.progress-fill[data-module="${i}"]`);
            if (fillEl) {
                fillEl.style.width = `${moduleProgress}%`;
            }

            // Update progress text
            const textEl = document.querySelector(`.progress-text[data-module="${i}"]`);
            if (textEl) {
                textEl.textContent = `${completed}/${total} lecciones`;
            }
        }
    },

    /**
     * Load progress on page init
     */
    loadProgress() {
        // Just ensure we have progress data
        const progress = this.getProgress();
        console.log('📚 Academy progress loaded:', progress);
    },

    /**
     * Reset all progress (for testing)
     */
    reset() {
        if (confirm('¿Estás seguro de que quieres reiniciar todo tu progreso?')) {
            localStorage.removeItem(this.STORAGE_KEY);
            location.reload();
        }
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    AcademyProgress.init();
});

// Expose globally for lesson pages
window.AcademyProgress = AcademyProgress;

console.log('📚 Academy.js loaded successfully');
