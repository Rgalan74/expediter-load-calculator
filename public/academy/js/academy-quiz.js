/**
 * academy-quiz.js
 * Motor compartido del quiz de fin de lección de Smart Load Academy.
 * Cada lección define su propio array de preguntas y llama a AcademyQuiz.init(...).
 */

const AcademyQuiz = {
    _state: null,

    /**
     * @param {number} moduleNum
     * @param {number} lessonNum
     * @param {Array<{question:string, options:string[], correctIndex:number}>} questions
     */
    async init(moduleNum, lessonNum, questions) {
        const container = document.getElementById('lessonQuiz');
        if (!container) return;

        this._state = {
            moduleNum,
            lessonNum,
            questions,
            selected: new Array(questions.length).fill(null),
        };

        const alreadyPassed = window.AcademyProgress
            ? await window.AcademyProgress.isQuizPassed(moduleNum, lessonNum)
            : false;

        if (alreadyPassed) {
            this._renderAlreadyPassed(container);
            this._unlockCompleteButton();
        } else {
            this._render(container);
            this._lockCompleteButton();
        }
    },

    _isEs() {
        return document.documentElement.lang === 'es';
    },

    _t(es, en) {
        return this._isEs() ? es : en;
    },

    _render(container) {
        const { questions } = this._state;

        container.innerHTML = `
            <div class="quiz-header">
                <h2>🧠 ${this._t('Comprueba lo que aprendiste', 'Check What You Learned')}</h2>
                <p class="quiz-subtitle">${this._t(
                    'Responde para desbloquear el botón de completar la lección. Reintentos ilimitados.',
                    'Answer to unlock the lesson-complete button. Unlimited retries.'
                )}</p>
            </div>
            <div id="quizQuestions">
                ${questions.map((q, qi) => this._questionHTML(q, qi)).join('')}
            </div>
            <div id="quizResult" class="quiz-result" style="display:none;"></div>
            <button id="quizSubmitBtn" class="btn btn-primary quiz-submit" disabled>${this._t('Enviar respuestas', 'Submit Answers')}</button>
        `;

        container.querySelectorAll('.quiz-option').forEach((optEl) => {
            optEl.addEventListener('click', () => this._selectOption(optEl));
        });
        document.getElementById('quizSubmitBtn').addEventListener('click', () => this._submit());
    },

    _questionHTML(q, qi) {
        return `
            <div class="quiz-question" data-qindex="${qi}">
                <p class="quiz-question-text">${qi + 1}. ${q.question}</p>
                <div class="quiz-options">
                    ${q.options.map((opt, oi) => `
                        <label class="quiz-option" data-qindex="${qi}" data-oindex="${oi}">
                            <span class="quiz-option-marker"></span>
                            <span>${opt}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _selectOption(optEl) {
        const qi = parseInt(optEl.dataset.qindex, 10);
        const oi = parseInt(optEl.dataset.oindex, 10);
        this._state.selected[qi] = oi;

        const questionEl = optEl.closest('.quiz-question');
        questionEl.querySelectorAll('.quiz-option').forEach((el) => el.classList.remove('selected'));
        optEl.classList.add('selected');

        const allAnswered = this._state.selected.every((s) => s !== null);
        const submitBtn = document.getElementById('quizSubmitBtn');
        if (submitBtn) submitBtn.disabled = !allAnswered;
    },

    async _submit() {
        const { questions, selected, moduleNum, lessonNum } = this._state;
        let score = 0;

        questions.forEach((q, qi) => {
            const questionEl = document.querySelector(`.quiz-question[data-qindex="${qi}"]`);
            const optionEls = questionEl.querySelectorAll('.quiz-option');
            optionEls.forEach((el, oi) => {
                el.classList.remove('correct', 'incorrect');
                if (oi === q.correctIndex) el.classList.add('correct');
                else if (oi === selected[qi]) el.classList.add('incorrect');
            });
            if (selected[qi] === q.correctIndex) score++;
        });

        const total = questions.length;
        const passed = window.AcademyProgress
            ? await window.AcademyProgress.recordQuizResult(moduleNum, lessonNum, score, total)
            : (total - score) <= 1;

        this._renderResult(score, total, passed);

        const submitBtn = document.getElementById('quizSubmitBtn');
        submitBtn.disabled = false;
        submitBtn.textContent = this._t('Reenviar respuestas', 'Resubmit Answers');

        if (passed) {
            this._unlockCompleteButton();
        }
    },

    _renderResult(score, total, passed) {
        const el = document.getElementById('quizResult');
        el.style.display = 'block';
        el.className = 'quiz-result ' + (passed ? 'quiz-result-pass' : 'quiz-result-fail');
        el.innerHTML = passed
            ? `<strong>✅ ${this._t(`¡Aprobado! ${score}/${total} correctas.`, `Passed! ${score}/${total} correct.`)}</strong>
               <p>${this._t('Ya puedes marcar la lección como completada.', 'You can now mark the lesson as complete.')}</p>`
            : `<strong>🔁 ${this._t(`${score}/${total} correctas — casi.`, `${score}/${total} correct — almost.`)}</strong>
               <p>${this._t('Revisa las respuestas marcadas arriba y vuelve a intentar, sin límite de intentos.', 'Check the marked answers above and try again — no limit on attempts.')}</p>`;
    },

    _renderAlreadyPassed(container) {
        container.innerHTML = `
            <div class="quiz-header">
                <h2>🧠 ${this._t('Comprueba lo que aprendiste', 'Check What You Learned')}</h2>
            </div>
            <div class="quiz-result quiz-result-pass" style="display:block;">
                <strong>✅ ${this._t('Quiz aprobado', 'Quiz passed')}</strong>
                <p>${this._t('Ya aprobaste el quiz de esta lección.', "You've already passed this lesson's quiz.")}</p>
            </div>
        `;
    },

    _lockCompleteButton() {
        document.querySelectorAll('#markCompleteBtn, #markCompleteBtn-en').forEach((btn) => {
            btn.disabled = true;
            btn.classList.add('quiz-locked');
            btn.title = this._t('Aprueba el quiz para continuar', 'Pass the quiz to continue');
        });
    },

    _unlockCompleteButton() {
        document.querySelectorAll('#markCompleteBtn, #markCompleteBtn-en').forEach((btn) => {
            // No reactivar un botón que ya quedó marcado como completado
            if (btn.dataset.lessonDone === 'true') return;
            btn.disabled = false;
            btn.classList.remove('quiz-locked');
            btn.removeAttribute('title');
        });
    },
};

window.AcademyQuiz = AcademyQuiz;
