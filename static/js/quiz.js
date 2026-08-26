// EduLearn Hub - Quiz Engine & Results Visualizer

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check if we are on Quiz List page
    initQuizListPage();

    // 2. Check if we are on Active Quiz page
    initQuizAttemptPage();

    // 3. Check if we are on Quiz Results page
    initQuizResultsPage();
});

// Quiz List Handler
function initQuizListPage() {
    const listGrid = document.getElementById("quiz-list-grid");
    if (!listGrid) return;

    const filterCategory = document.getElementById("filter-category");
    const filterDifficulty = document.getElementById("filter-difficulty");

    // Load initial list
    fetchQuizList();

    if (filterCategory && filterDifficulty) {
        filterCategory.addEventListener("change", fetchQuizList);
        filterDifficulty.addEventListener("change", fetchQuizList);
    }

    function fetchQuizList() {
        const cat = filterCategory ? filterCategory.value : "";
        const diff = filterDifficulty ? filterDifficulty.value : "";
        
        let url = `/api/quiz/list?category=${cat}&difficulty=${diff}`;

        fetch(url)
            .then(res => res.json())
            .then(quizzes => {
                if (quizzes.length === 0) {
                    listGrid.innerHTML = `
                        <div class="glass-panel" style="grid-column: 1/-1; padding: 40px; text-align: center;">
                            <h3>No quizzes found</h3>
                            <p style="color: var(--text-secondary); margin-top: 8px;">Try changing your category or difficulty filters.</p>
                        </div>
                    `;
                    return;
                }

                listGrid.innerHTML = quizzes.map(q => `
                    <div class="glass-panel quiz-card fade-in-el">
                        <div class="quiz-card-header">
                            <span class="category-tag ${q.category.toLowerCase()}">${q.category}</span>
                            <span class="difficulty-badge ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                        </div>
                        <h3 class="quiz-card-title">${escapeHTML(q.title)}</h3>
                        <div class="quiz-card-meta">
                            <span><i class="fa-regular fa-clock"></i> ${q.duration} Mins</span>
                            <span><i class="fa-regular fa-circle-question"></i> ${q.total_questions} Qs</span>
                            <span><i class="fa-regular fa-star"></i> ${q.total_marks} Marks</span>
                        </div>
                        <a href="/student/quiz/attempt/${q.quiz_id}" class="btn btn-primary" style="margin-top: auto; width: 100%;">Attempt Exam</a>
                    </div>
                `).join("");
            })
            .catch(err => console.error(err));
    }
}

// Active Quiz Attempt Logic
function initQuizAttemptPage() {
    const attemptContainer = document.getElementById("active-quiz-attempt-view");
    if (!attemptContainer) return;

    const quizId = document.getElementById("active-quiz-id").value;
    
    // Quiz State
    let quizData = null;
    let questions = [];
    let currentIndex = 0;
    let userAnswers = {}; // {question_id: user_choice_string}
    let durationSeconds = 0;
    let timerInterval = null;

    // Load Quiz details
    fetch(`/api/quiz/${quizId}`)
        .then(res => res.json())
        .then(data => {
            quizData = data.quiz;
            questions = data.questions;
            durationSeconds = quizData.duration * 60;
            
            // Render basic UI skeleton
            renderQuizSkeleton();
            // Start Timer
            startQuizTimer();
            // Render Current Question
            showQuestion(0);
        })
        .catch(err => {
            console.error(err);
            showToast("Failed to load quiz details", "error");
        });

    function renderQuizSkeleton() {
        document.getElementById("attempt-quiz-title").textContent = quizData.title;
        
        // Render Selector Grid
        const grid = document.getElementById("sidebar-selector-grid");
        if (grid) {
            grid.innerHTML = questions.map((q, idx) => `
                <div class="q-grid-btn" id="q-btn-${idx}" onclick="jumpToQuestion(${idx})">${idx + 1}</div>
            `).join("");
        }
    }

    function startQuizTimer() {
        const timerVal = document.getElementById("active-timer-val");
        if (!timerVal) return;

        function updateTimerDisplay() {
            if (durationSeconds <= 0) {
                clearInterval(timerInterval);
                timerVal.textContent = "00:00";
                autoSubmitQuiz();
                return;
            }
            
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = durationSeconds % 60;
            
            timerVal.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (durationSeconds < 60) {
                timerVal.style.color = "var(--danger)";
            }
            durationSeconds--;
        }

        updateTimerDisplay();
        timerInterval = setInterval(updateTimerDisplay, 1000);
    }

    window.jumpToQuestion = function(idx) {
        // Save current choice first if any (handled click select)
        currentIndex = idx;
        showQuestion(currentIndex);
    };

    function showQuestion(idx) {
        if (idx < 0 || idx >= questions.length) return;
        
        currentIndex = idx;
        const q = questions[idx];

        // Highlight grid selection
        questions.forEach((_, i) => {
            const btn = document.getElementById(`q-btn-${i}`);
            if (btn) {
                btn.classList.remove("active");
                if (userAnswers[questions[i].id]) {
                    btn.classList.add("answered");
                }
            }
        });
        const currentBtn = document.getElementById(`q-btn-${idx}`);
        if (currentBtn) currentBtn.classList.add("active");

        // Populate question text
        document.getElementById("attempt-q-num").textContent = `Question ${idx + 1} of ${questions.length}`;
        document.getElementById("attempt-q-marks").textContent = `Marks: ${q.marks}`;
        document.getElementById("attempt-question-text").textContent = q.question_text;

        // Render options list
        const optionsList = document.getElementById("attempt-options-list");
        optionsList.innerHTML = q.options.map((opt, oIdx) => {
            const prefixes = ["A", "B", "C", "D", "E"];
            const prefix = prefixes[oIdx] || "";
            const isSelected = userAnswers[q.id] === opt;
            return `
                <div class="option-item ${isSelected ? 'selected' : ''}" onclick="selectOption(${q.id}, '${opt.replace(/'/g, "\\'")}')">
                    <div class="option-prefix">${prefix}</div>
                    <div class="option-text">${escapeHTML(opt)}</div>
                </div>
            `;
        }).join("");

        // Update Nav button display
        const prevBtn = document.getElementById("quiz-prev-btn");
        const nextBtn = document.getElementById("quiz-next-btn");
        
        if (idx === 0) {
            prevBtn.style.visibility = "hidden";
        } else {
            prevBtn.style.visibility = "visible";
        }

        if (idx === questions.length - 1) {
            nextBtn.textContent = "Finish Exam";
            nextBtn.className = "btn btn-primary";
        } else {
            nextBtn.textContent = "Next Question";
            nextBtn.className = "btn btn-secondary";
        }
    }

    window.selectOption = function(qId, val) {
        userAnswers[qId] = val;
        
        // Refresh options display
        const q = questions[currentIndex];
        const optionsList = document.getElementById("attempt-options-list");
        optionsList.innerHTML = q.options.map((opt, oIdx) => {
            const prefixes = ["A", "B", "C", "D"];
            const prefix = prefixes[oIdx] || "";
            const isSelected = userAnswers[q.id] === opt;
            return `
                <div class="option-item ${isSelected ? 'selected' : ''}" onclick="selectOption(${q.id}, '${opt.replace(/'/g, "\\'")}')">
                    <div class="option-prefix">${prefix}</div>
                    <div class="option-text">${escapeHTML(opt)}</div>
                </div>
            `;
        }).join("");

        // Highlight grid
        const btn = document.getElementById(`q-btn-${currentIndex}`);
        if (btn) btn.classList.add("answered");
    };

    // Nav Bindings
    document.getElementById("quiz-prev-btn").addEventListener("click", () => {
        if (currentIndex > 0) showQuestion(currentIndex - 1);
    });

    document.getElementById("quiz-next-btn").addEventListener("click", () => {
        if (currentIndex < questions.length - 1) {
            showQuestion(currentIndex + 1);
        } else {
            // Last question, trigger submit check
            confirmSubmitQuiz();
        }
    });

    function confirmSubmitQuiz() {
        const answeredCount = Object.keys(userAnswers).length;
        const msg = `You have answered ${answeredCount} of ${questions.length} questions. Are you sure you want to finish and submit the exam?`;
        if (confirm(msg)) {
            submitQuizAttempt();
        }
    }

    function autoSubmitQuiz() {
        showToast("Time's up! Automatically submitting your answers...", "error");
        submitQuizAttempt();
    }

    function submitQuizAttempt() {
        clearInterval(timerInterval);
        
        const timeTaken = (quizData.duration * 60) - durationSeconds;
        const payload = {
            quiz_id: quizId,
            answers: userAnswers,
            time_taken: timeTaken
        };

        // Determine submit URL: check if this is AI submission
        const url = quizId.startsWith("AIQ") ? "/api/ai-quiz/submit" : "/api/quiz/attempt";

        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const result = await res.json();
            if (res.ok) {
                showToast("Quiz submitted successfully!");
                setTimeout(() => {
                    window.location.href = `/student/results/${result.attempt_id}`;
                }, 1000);
            } else {
                showToast(result.error || "Submission failed", "error");
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Failed to submit exam due to network error.", "error");
        });
    }
}

// Quiz Results review
function initQuizResultsPage() {
    const resultsContainer = document.getElementById("quiz-results-display-view");
    if (!resultsContainer) return;

    const attemptId = document.getElementById("results-attempt-id").value;

    fetch(`/api/quiz/results/${attemptId}`)
        .then(res => res.json())
        .then(data => {
            const attempt = data.attempt;
            const answers = data.answers;

            // Fill header statistics
            document.getElementById("res-title").textContent = attempt.title;
            document.getElementById("res-category").textContent = attempt.category;
            document.getElementById("res-category").className = `category-tag ${attempt.category.toLowerCase()}`;
            document.getElementById("res-difficulty").textContent = attempt.difficulty;
            document.getElementById("res-difficulty").className = `difficulty-badge ${attempt.difficulty.toLowerCase()}`;
            
            document.getElementById("res-score").textContent = `${attempt.score} / ${attempt.total_marks}`;
            
            const percentage = (attempt.score / attempt.total_marks) * 100;
            document.getElementById("res-percentage").textContent = `${percentage.toFixed(1)}%`;
            document.getElementById("res-correct").textContent = attempt.correct_answers;
            document.getElementById("res-wrong").textContent = attempt.wrong_answers;
            
            // Format time taken
            const minutes = Math.floor(attempt.time_taken / 60);
            const seconds = attempt.time_taken % 60;
            document.getElementById("res-time").textContent = `${minutes}m ${seconds}s`;

            // Populate Questions Review Diffs
            const reviewList = document.getElementById("res-questions-review-list");
            reviewList.innerHTML = answers.map((ans, idx) => {
                const isCorrect = ans.is_correct === 1;
                return `
                    <div class="glass-panel review-card ${isCorrect ? 'correct' : 'wrong'} fade-in-el">
                        <div class="review-badge ${isCorrect ? 'correct' : 'wrong'}">
                            ${isCorrect ? '<i class="fas fa-check"></i> Correct' : '<i class="fas fa-xmark"></i> Incorrect'}
                        </div>
                        <h4 style="margin-bottom: 12px;">Q${idx + 1}. ${escapeHTML(ans.question_text)}</h4>
                        
                        <div class="options-list" style="margin-bottom: 15px;">
                            ${ans.options.map(opt => {
                                const isUserChoice = ans.user_answer === opt;
                                const isCorrectChoice = ans.correct_answer === opt;
                                
                                let optClass = '';
                                let icon = '';
                                
                                if (isCorrectChoice) {
                                    optClass = 'selected'; // Highlight correct answer in green outline
                                }
                                
                                return `
                                    <div class="option-item ${optClass}" style="cursor:default; ${isUserChoice ? 'border-color:var(--text-secondary); background:rgba(255,255,255,0.03);' : ''}">
                                        <div class="option-text">
                                            ${escapeHTML(opt)}
                                            ${isUserChoice ? ' <span style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">(Your Choice)</span>' : ''}
                                            ${isCorrectChoice ? ' <span style="font-size:0.8rem; color:var(--success); font-weight:600;"><i class="fas fa-circle-check"></i> (Correct Answer)</span>' : ''}
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                        
                        <div class="review-explanation">
                            <strong>Explanation:</strong> ${escapeHTML(ans.explanation || 'No explanation available.')}
                        </div>
                    </div>
                `;
            }).join("");
        })
        .catch(err => {
            console.error(err);
            showToast("Failed to load quiz results details", "error");
        });
}
