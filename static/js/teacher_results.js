// EduLearn Hub - Teacher Quiz Results, Analysis & Leaderboard

document.addEventListener("DOMContentLoaded", () => {
    initTeacherResultsOverview();
    initTeacherQuizResultsDetail();
    initTeacherQuizAnalysis();
    initTeacherLeaderboard();
});

// ------------------------------------------------------------------
// 1. RESULTS OVERVIEW - list of all quizzes created by this teacher
// ------------------------------------------------------------------
function initTeacherResultsOverview() {
    const body = document.getElementById("teacher-quiz-results-body");
    if (!body) return;

    fetch("/api/teacher/quizzes-summary")
        .then(res => res.json())
        .then(quizzes => {
            if (quizzes.length === 0) {
                body.innerHTML = '<tr><td colspan="8" style="text-align:center;">You haven\'t created any quizzes yet.</td></tr>';
                return;
            }

            body.innerHTML = quizzes.map(q => {
                const avgPct = q.total_marks > 0 ? (q.avg_score / q.total_marks * 100) : 0;
                return `
                <tr class="fade-in-el">
                    <td><strong>${escapeHTML(q.title)}</strong><br><small style="color:var(--text-muted)">${q.quiz_id}</small></td>
                    <td><span class="category-tag ${q.category.toLowerCase()}">${escapeHTML(q.category)}</span></td>
                    <td><span class="difficulty-badge ${q.difficulty.toLowerCase()}">${escapeHTML(q.difficulty)}</span></td>
                    <td>${q.total_attempts}</td>
                    <td><span class="status-badge ${avgPct >= 60 ? 'active' : 'pending'}">${avgPct.toFixed(1)}%</span></td>
                    <td>${q.highest_score} / ${q.total_marks}</td>
                    <td>${q.lowest_score} / ${q.total_marks}</td>
                    <td style="display:flex; gap:8px;">
                        <a href="/teacher/results/${q.quiz_id}" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">Results</a>
                        <a href="/teacher/analysis/${q.quiz_id}" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;">Analysis</a>
                    </td>
                </tr>
            `;
            }).join("");
        })
        .catch(err => {
            console.error("Error loading quiz results summary:", err);
            body.innerHTML = '<tr><td colspan="8" style="text-align:center;">Failed to load quiz results.</td></tr>';
        });
}

// ------------------------------------------------------------------
// 2. QUIZ RESULTS DETAIL - per-student attempts for a single quiz
// ------------------------------------------------------------------
function initTeacherQuizResultsDetail() {
    const body = document.getElementById("quiz-results-detail-body");
    if (!body) return;

    const quizIdInput = document.getElementById("target-quiz-id");
    const quizId = quizIdInput ? quizIdInput.value : "";
    if (!quizId) return;

    const analysisLink = document.getElementById("view-analysis-link");
    if (analysisLink) analysisLink.href = `/teacher/analysis/${quizId}`;

    fetch(`/api/teacher/quiz/${quizId}/results`)
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load results");
            return data;
        })
        .then(data => {
            const quiz = data.quiz;
            const results = data.results;

            const titleEl = document.getElementById("quiz-results-title");
            const subtitleEl = document.getElementById("quiz-results-subtitle");
            if (titleEl) titleEl.textContent = `Results: ${quiz.title}`;
            if (subtitleEl) subtitleEl.textContent = `${quiz.category} • ${quiz.difficulty} • ${quiz.total_marks} marks • ${quiz.total_questions} questions`;

            const totalAttemptsEl = document.getElementById("qr-total-attempts");
            const avgScoreEl = document.getElementById("qr-avg-score");
            const highestScoreEl = document.getElementById("qr-highest-score");

            if (totalAttemptsEl) totalAttemptsEl.textContent = results.length;

            if (results.length > 0) {
                const avg = results.reduce((sum, r) => sum + r.score, 0) / results.length;
                const highest = Math.max(...results.map(r => r.score));
                if (avgScoreEl) avgScoreEl.textContent = `${avg.toFixed(1)} / ${quiz.total_marks}`;
                if (highestScoreEl) highestScoreEl.textContent = `${highest} / ${quiz.total_marks}`;
            } else {
                if (avgScoreEl) avgScoreEl.textContent = `0 / ${quiz.total_marks}`;
                if (highestScoreEl) highestScoreEl.textContent = `0 / ${quiz.total_marks}`;
            }

            if (results.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align:center;">No students have attempted this quiz yet.</td></tr>';
                return;
            }

            // Pass mark = 40% of total, a reasonable default used purely for display
            const passMark = quiz.total_marks * 0.4;

            body.innerHTML = results.map(r => {
                const passed = r.score >= passMark;
                return `
                <tr class="fade-in-el">
                    <td>${rankBadgeHTML(r.rank)}</td>
                    <td><strong>${escapeHTML(r.student_name)}</strong><br><small style="color:var(--text-muted)">${escapeHTML(r.student_email)}</small></td>
                    <td><strong>${r.score} / ${r.total_marks}</strong></td>
                    <td><span style="color:var(--success)">${r.correct_answers} correct</span> / <span style="color:var(--danger)">${r.wrong_answers} wrong</span></td>
                    <td>${Math.round(r.time_taken / 60)} min</td>
                    <td><span class="status-badge ${passed ? 'active' : 'blocked'}">${passed ? 'Pass' : 'Fail'}</span></td>
                    <td>${formatDate(r.completed_at)}</td>
                </tr>
            `;
            }).join("");
        })
        .catch(err => {
            console.error("Error loading quiz results detail:", err);
            body.innerHTML = `<tr><td colspan="7" style="text-align:center;">${escapeHTML(err.message || "Failed to load results.")}</td></tr>`;
        });
}

// ------------------------------------------------------------------
// 3. QUIZ ANALYSIS - class stats, score distribution, question diff.
// ------------------------------------------------------------------
function initTeacherQuizAnalysis() {
    const chartCanvas = document.getElementById("quiz-score-distribution-chart");
    if (!chartCanvas) return;

    const quizIdInput = document.getElementById("target-quiz-id");
    const quizId = quizIdInput ? quizIdInput.value : "";
    if (!quizId) return;

    const backLink = document.getElementById("back-to-results-link");
    if (backLink) backLink.href = `/teacher/results/${quizId}`;

    fetch(`/api/teacher/quiz/${quizId}/analysis`)
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load analysis");
            return data;
        })
        .then(data => {
            const quiz = data.quiz;
            const summary = data.summary;

            const titleEl = document.getElementById("quiz-analysis-title");
            const subtitleEl = document.getElementById("quiz-analysis-subtitle");
            if (titleEl) titleEl.textContent = `Analysis: ${quiz.title}`;
            if (subtitleEl) subtitleEl.textContent = `${quiz.category} • ${quiz.difficulty} • Based on ${summary.total_attempts} attempt(s)`;

            const avgScoreEl = document.getElementById("qa-avg-score");
            const avgCorrectEl = document.getElementById("qa-avg-correct");
            const avgTimeEl = document.getElementById("qa-avg-time");

            const avgPct = quiz.total_marks > 0 ? (summary.avg_score / quiz.total_marks * 100) : 0;
            if (avgScoreEl) avgScoreEl.textContent = `${avgPct.toFixed(1)}%`;
            if (avgCorrectEl) avgCorrectEl.textContent = Number(summary.avg_correct).toFixed(1);
            if (avgTimeEl) avgTimeEl.textContent = `${Math.round(summary.avg_time_taken / 60)} min`;

            // Score Distribution Bar Chart
            const distCtx = chartCanvas.getContext("2d");
            const distLabels = Object.keys(data.score_distribution);
            const distValues = Object.values(data.score_distribution);

            new Chart(distCtx, {
                type: 'bar',
                data: {
                    labels: distLabels,
                    datasets: [{
                        label: 'Number of Students',
                        data: distValues,
                        backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24', '#3b82f6', '#10b981'],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            ticks: { color: '#9ca3af', stepSize: 1 },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        x: {
                            ticks: { color: '#9ca3af' },
                            grid: { display: false }
                        }
                    }
                }
            });

            // Correct vs Wrong Doughnut
            const accCtx = document.getElementById("quiz-accuracy-chart").getContext("2d");
            const totalCorrect = summary.avg_correct * summary.total_attempts;
            const totalWrong = summary.avg_wrong * summary.total_attempts;

            new Chart(accCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Correct Answers', 'Wrong Answers'],
                    datasets: [{
                        data: [totalCorrect, totalWrong],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#9ca3af' } }
                    }
                }
            });

            // Question-wise difficulty list
            const listContainer = document.getElementById("question-breakdown-list");
            if (listContainer) {
                if (data.question_breakdown.length === 0) {
                    listContainer.innerHTML = '<p style="color:var(--text-muted);">No question data available yet.</p>';
                } else {
                    listContainer.innerHTML = data.question_breakdown.map((q, idx) => {
                        const barClass = q.accuracy_percent >= 70 ? 'success' : (q.accuracy_percent >= 40 ? 'warning' : 'danger');
                        return `
                        <div class="perf-bar-container">
                            <div class="perf-bar-label">
                                <span><strong>Q${idx + 1}.</strong> ${escapeHTML(truncateText(q.question_text, 90))}</span>
                                <span>${q.accuracy_percent}% correct (${q.correct_count}/${q.total_answered})</span>
                            </div>
                            <div class="perf-bar-outer">
                                <div class="perf-bar-inner ${barClass}" style="width:${q.accuracy_percent}%;"></div>
                            </div>
                        </div>
                    `;
                    }).join("");
                }
            }
        })
        .catch(err => {
            console.error("Error loading quiz analysis:", err);
            showToast(err.message || "Failed to load quiz analysis", "error");
        });
}

// ------------------------------------------------------------------
// 4. LEADERBOARD - overall ranking + per-quiz ranking (teacher view)
// ------------------------------------------------------------------
function initTeacherLeaderboard() {
    const podiumEl = document.getElementById("leaderboard-podium");
    const tableBody = document.getElementById("leaderboard-table-body");
    if (!podiumEl || !tableBody) return;

    const tabButtons = document.querySelectorAll(".leaderboard-tab-btn");
    const quizSelectorWrap = document.getElementById("leaderboard-quiz-selector");
    const quizSelect = document.getElementById("leaderboard-quiz-select");
    const scoreColHeader = document.getElementById("leaderboard-score-col-header");
    const extraColHeader = document.getElementById("leaderboard-extra-col-header");

    let currentTab = "overall";
    let quizzesLoaded = false;

    // Determine API base depending on whether this is teacher or admin page
    const isAdminPage = window.location.pathname.startsWith("/admin/");
    const overallEndpoint = isAdminPage ? "/api/admin/leaderboard/overall" : "/api/teacher/leaderboard/overall";
    const quizListEndpoint = isAdminPage ? "/api/quiz/list" : "/api/teacher/quizzes-lite";
    const perQuizEndpoint = (quizId) => isAdminPage
        ? `/api/teacher/leaderboard/quiz/${quizId}`  // admins reuse teacher endpoint (read-only, role-checked via login_required)
        : `/api/teacher/leaderboard/quiz/${quizId}`;

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => {
                b.classList.remove("active", "btn-primary");
                b.classList.add("btn-secondary");
            });
            btn.classList.add("active", "btn-primary");
            btn.classList.remove("btn-secondary");

            currentTab = btn.dataset.tab;

            if (currentTab === "overall") {
                quizSelectorWrap.style.display = "none";
                scoreColHeader.textContent = "Average Score";
                extraColHeader.textContent = "Attempts";
                loadOverallLeaderboard();
            } else {
                quizSelectorWrap.style.display = "block";
                scoreColHeader.textContent = "Score";
                extraColHeader.textContent = "Time Taken";
                if (!quizzesLoaded) loadQuizListForSelector();
                if (quizSelect.value) loadPerQuizLeaderboard(quizSelect.value);
            }
        });
    });

    if (quizSelect) {
        quizSelect.addEventListener("change", () => {
            if (quizSelect.value) loadPerQuizLeaderboard(quizSelect.value);
        });
    }

    function loadQuizListForSelector() {
        fetch(quizListEndpoint)
            .then(res => res.json())
            .then(quizzes => {
                quizzesLoaded = true;
                if (!quizzes || quizzes.length === 0) {
                    quizSelect.innerHTML = '<option value="">No quizzes available</option>';
                    return;
                }
                quizSelect.innerHTML = '<option value="">Select a quiz...</option>' +
                    quizzes.map(q => `<option value="${q.quiz_id}">${escapeHTML(q.title)} (${escapeHTML(q.category)})</option>`).join("");
            })
            .catch(err => {
                console.error("Error loading quiz list for leaderboard:", err);
                quizSelect.innerHTML = '<option value="">Failed to load quizzes</option>';
            });
    }

    function loadOverallLeaderboard() {
        fetch(overallEndpoint)
            .then(res => res.json())
            .then(data => renderLeaderboard(data, "overall"))
            .catch(err => {
                console.error("Error loading overall leaderboard:", err);
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Failed to load leaderboard.</td></tr>';
            });
    }

    function loadPerQuizLeaderboard(quizId) {
        fetch(perQuizEndpoint(quizId))
            .then(res => res.json())
            .then(data => renderLeaderboard(data.leaderboard || [], "per-quiz"))
            .catch(err => {
                console.error("Error loading per-quiz leaderboard:", err);
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Failed to load leaderboard.</td></tr>';
            });
    }

    function renderLeaderboard(rows, mode) {
        if (!rows || rows.length === 0) {
            podiumEl.innerHTML = "";
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No ranking data available yet.</td></tr>';
            return;
        }

        // Podium for top 3
        const top3 = rows.slice(0, 3);
        podiumEl.innerHTML = top3.map(r => {
            const avatarUrl = r.avatar ? `/uploads/avatars/${r.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=3b82f6&color=fff`;
            const scoreDisplay = mode === "overall"
                ? `${Number(r.avg_percent).toFixed(1)}%`
                : `${r.score} / ${r.total_marks}`;
            const metaDisplay = mode === "overall"
                ? `${r.total_attempts} attempts`
                : `${Math.round(r.time_taken / 60)} min`;

            return `
                <div class="glass-panel podium-card rank-${r.rank} fade-in-el">
                    <div class="podium-medal">${r.rank}</div>
                    <img src="${avatarUrl}" alt="" class="podium-avatar">
                    <div class="podium-name">${escapeHTML(r.name)}</div>
                    <div class="podium-score">${scoreDisplay}</div>
                    <div class="podium-meta">${metaDisplay}</div>
                </div>
            `;
        }).join("");

        // Full table
        tableBody.innerHTML = rows.map(r => {
            const scoreCell = mode === "overall"
                ? `${Number(r.avg_percent).toFixed(1)}%`
                : `${r.score} / ${r.total_marks}`;
            const extraCell = mode === "overall"
                ? `${r.total_attempts}`
                : `${Math.round(r.time_taken / 60)} min`;

            return `
                <tr class="fade-in-el">
                    <td>${rankBadgeHTML(r.rank)}</td>
                    <td><strong>${escapeHTML(r.name)}</strong><br><small style="color:var(--text-muted)">${escapeHTML(r.email)}</small></td>
                    <td><strong>${scoreCell}</strong></td>
                    <td>${extraCell}</td>
                </tr>
            `;
        }).join("");
    }

    // Initial load
    loadOverallLeaderboard();
}

// ------------------------------------------------------------------
// Note: rankBadgeHTML() and truncateText() are defined globally in main.js
// ------------------------------------------------------------------
