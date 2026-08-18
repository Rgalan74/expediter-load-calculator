/**
 * SMART LOAD ACADEMY - Lesson sidebar navigation
 * Renders the current module's lesson list, highlights the active/completed
 * lessons, and wires the mobile open/close toggle.
 */
const AcademySidebar = {
    async init(moduleNum, lessonNum, moduleName, lessons) {
        const sidebar = document.getElementById('lessonSidebar');
        if (!sidebar) return;

        const isEs = document.documentElement.lang === 'es';

        const labelEl = document.getElementById('lessonSidebarModuleLabel');
        const titleEl = document.getElementById('lessonSidebarModuleTitle');
        if (labelEl) labelEl.textContent = (isEs ? 'Módulo ' : 'Module ') + moduleNum;
        if (titleEl) titleEl.textContent = moduleName;

        const listEl = document.getElementById('lessonSidebarList');
        if (listEl) {
            listEl.innerHTML = '';
            for (const lesson of lessons) {
                const isDone = window.AcademyProgress
                    ? await window.AcademyProgress.isLessonComplete(moduleNum, lesson.num)
                    : false;

                const a = document.createElement('a');
                a.href = `lesson-${lesson.num}.html`;
                a.className = 'lesson-sidebar-item' + (lesson.num === lessonNum ? ' active' : '') + (isDone ? ' completed' : '');

                const marker = document.createElement('div');
                marker.className = 'lesson-sidebar-marker';
                marker.textContent = isDone ? '✓' : String(lesson.num);

                const textWrap = document.createElement('div');
                const titleDiv = document.createElement('div');
                titleDiv.className = 'lesson-sidebar-item-title';
                titleDiv.textContent = lesson.title;
                const timeDiv = document.createElement('div');
                timeDiv.className = 'lesson-sidebar-item-time';
                timeDiv.textContent = lesson.time;
                textWrap.appendChild(titleDiv);
                textWrap.appendChild(timeDiv);

                a.appendChild(marker);
                a.appendChild(textWrap);
                listEl.appendChild(a);
            }
        }

        this._setupToggle();
    },

    _setupToggle() {
        const sidebar = document.getElementById('lessonSidebar');
        const toggleBtn = document.getElementById('lessonSidebarToggle');
        const closeBtn = document.getElementById('lessonSidebarClose');
        const overlay = document.getElementById('lessonSidebarOverlay');
        if (!sidebar) return;

        const open = () => {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('open');
        };
        const close = () => {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
        };

        if (toggleBtn) toggleBtn.addEventListener('click', open);
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (overlay) overlay.addEventListener('click', close);
    }
};

window.AcademySidebar = AcademySidebar;
