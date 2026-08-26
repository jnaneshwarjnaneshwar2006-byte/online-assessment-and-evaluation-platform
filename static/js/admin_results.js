// EduLearn Hub - Admin Quiz Results Overview & Detail

document.addEventListener("DOMContentLoaded", () => {
    initAdminResultsOverview();
    initAdminQuizResultsDetail();
});

// Note: rankBadgeHTML() is defined globally in main.js

// ------------------------------------------------------------------
// 1. RESULTS OVERVIEW - every quiz across every teacher
// ------------------------------------------------------------------
function initAdminResultsOverview() {
    const body = document.getElementById("admin-quiz-overview-body");
    if (!body) return;

    const categoryFilter = document.getElementById("overview-category-filter");
    const teacherFilter = document.getElementById("overview-teacher-filter");

    let allQuizzes = [];

    fetch("/api/admin/quizzes-overview")
        .then(res => res.json())
        .then(quizzes => {
            allQuizzes = quizzes;
            populateTeacherFilter(quizzes);
            renderQuizzes(quizzes);
        })
        .catch(err => {
            console.error("Error loading admin quiz overview:", err);
            body.innerHTML = '<tr><td colspan="9" style="text-align:center;">Failed to load quiz results overview.</td></tr>';
        });

    if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
    if (teacherFilter) teacherFilter.addEventListener("change", applyFilters);

    function populateTeacherFilter(quizzes) {
        if (!teacherFilter) return;
        const teacherMap = new Map();
        quizzes.forEach(q => {
            if (!teacherMap.has(q.created_by)) {
                teacherMap.set(q.created_by, q.creator_name);
            }
        });
        teacherFilter.innerHTML = '<option value="">All Teachers</option>' +
            Array.from(teacherMap.entries()).map(([id, name]) =>
                `<option value="${id}">${escapeHTML(name)} (${id})</option>`
            ).join("");
    }

    function applyFilters() {
        const cat = categoryFilter ? categoryFilter.value : "";
        const teacherId = teacherFilter ? teacherFilter.value : "";

        let filtered = allQuizzes;
        if (cat) filtered = filtered.filter(q => q.category === cat);
        if (teacherId) filtered = filtered.filter(q => q.created_by === teacherId);

        renderQuizzes(filtered);
    }

    function renderQuizzes(quizzes) {
        if (quizzes.length === 0) {
            body.innerHTML = '<tr><td colspan="9" style="text-align:center;">No quizzes found.</td></tr>';
            return;
        }

        body.innerHTML = quizzes.map(q => {
            const avgPct = q.total_marks > 0 ? (q.avg_score / q.total_marks * 100) : 0;
            return `
            <tr class="fade-in-el">
                <td><strong>${escapeHTML(q.title)}</strong><br><small style="color:var(--text-muted)">${q.quiz_id}</small></td>
                <td>${escapeHTML(q.creator_name)}<br><small style="color:var(--text-muted)">${q.creator_role}</small></td>
                <td><span class="category-tag ${q.category.toLowerCase()}">${escapeHTML(q.category)}</span></td>
                <td><span class="difficulty-badge ${q.difficulty.toLowerCase()}">${escapeHTML(q.difficulty)}</span></td>
                <td>${q.total_attempts}</td>
                <td><span class="status-badge ${avgPct >= 60 ? 'active' : 'pending'}">${avgPct.toFixed(1)}%</span></td>
                <td>${q.highest_score} / ${q.total_marks}</td>
                <td>${q.lowest_score} / ${q.total_marks}</td>
                <td>
                    <a href="/admin/quiz-results/${q.quiz_id}" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">View Results</a>
                </td>
            </tr>
        `;
        }).join("");
    }
}

// ------------------------------------------------------------------
// 2. QUIZ RESULTS DETAIL (admin) - every student attempt for one quiz
// ------------------------------------------------------------------
function initAdminQuizResultsDetail() {
    const body = document.getElementById("admin-quiz-results-detail-body");
    if (!body) return;

    const quizIdInput = document.getElementById("target-quiz-id");
    const quizId = quizIdInput ? quizIdInput.value : "";
    if (!quizId) return;

    fetch(`/api/admin/quiz/${quizId}/results`)
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load results");
            return data;
        })
        .then(data => {
            const quiz = data.quiz;
            const results = data.results;

            const titleEl = document.getElementById("admin-qr-title");
            const subtitleEl = document.getElementById("admin-qr-subtitle");
            if (titleEl) titleEl.textContent = `Results: ${quiz.title}`;
            if (subtitleEl) subtitleEl.textContent = `${quiz.category} • ${quiz.difficulty} • ${quiz.total_marks} marks • ${quiz.total_questions} questions`;

            const totalAttemptsEl = document.getElementById("admin-qr-total-attempts");
            const avgScoreEl = document.getElementById("admin-qr-avg-score");
            const creatorEl = document.getElementById("admin-qr-creator");

            if (totalAttemptsEl) totalAttemptsEl.textContent = results.length;
            if (creatorEl) creatorEl.textContent = `${quiz.creator_name} (${quiz.creator_role})`;

            if (results.length > 0) {
                const avg = results.reduce((sum, r) => sum + r.score, 0) / results.length;
                if (avgScoreEl) avgScoreEl.textContent = `${avg.toFixed(1)} / ${quiz.total_marks}`;
            } else {
                if (avgScoreEl) avgScoreEl.textContent = `0 / ${quiz.total_marks}`;
            }

            if (results.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align:center;">No students have attempted this quiz yet.</td></tr>';
                return;
            }

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
            console.error("Error loading admin quiz results detail:", err);
            body.innerHTML = `<tr><td colspan="7" style="text-align:center;">${escapeHTML(err.message || "Failed to load results.")}</td></tr>`;
        });
}
