// EduLearn Hub - Role-Based Dashboard Handlers

document.addEventListener("DOMContentLoaded", () => {
    const userRoleEl = document.getElementById("dashboard-role-identifier");
    if (!userRoleEl) return;

    const role = userRoleEl.value; // 'student', 'teacher', 'admin'
    
    if (role === 'student') {
        loadStudentDashboard();
    } else if (role === 'teacher') {
        loadTeacherDashboard();
    } else if (role === 'admin') {
        loadAdminDashboard();
    }
});

function loadStudentDashboard() {
    // 1. Fetch Student History & Analytics
    fetch("/api/student/history")
        .then(res => res.json())
        .then(history => {
            const totalAttemptsEl = document.getElementById("dash-student-total-attempts");
            const avgScoreEl = document.getElementById("dash-student-avg-score");
            
            if (totalAttemptsEl) totalAttemptsEl.textContent = history.length;
            
            if (history.length > 0) {
                const totalScore = history.reduce((sum, item) => sum + (item.score / item.total_marks * 100), 0);
                const avgPercent = totalScore / history.length;
                if (avgScoreEl) avgScoreEl.textContent = `${avgPercent.toFixed(1)}%`;
            } else {
                if (avgScoreEl) avgScoreEl.textContent = "0.0%";
            }

            // Populate recent quiz list
            const recentTable = document.getElementById("student-recent-attempts-body");
            if (recentTable) {
                if (history.length === 0) {
                    recentTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">No quiz attempts found. Start learning today!</td></tr>';
                    return;
                }
                recentTable.innerHTML = history.slice(0, 5).map(item => `
                    <tr>
                        <td><strong>${escapeHTML(item.title)}</strong></td>
                        <td><span class="category-tag ${item.category.toLowerCase()}">${item.category}</span></td>
                        <td>${item.score} / ${item.total_marks}</td>
                        <td>${Math.round(item.time_taken / 60)} mins</td>
                        <td><a href="/student/results/${item.attempt_id}" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;">Review</a></td>
                    </tr>
                `).join("");
            }
        })
        .catch(err => console.error("Error loading student dash:", err));

    // 2. Fetch AI Recommendations
    fetch("/api/student/recommendations")
        .then(res => res.json())
        .then(data => {
            const recContainer = document.getElementById("dash-recommendations-list");
            if (recContainer && data.recommendations) {
                recContainer.innerHTML = data.recommendations.map(rec => `
                    <div class="notification-item">
                        <div class="notif-icon"><i class="fas fa-brain"></i></div>
                        <div class="notif-details">
                            <div class="notif-title">Study Tip</div>
                            <div class="notif-desc">${escapeHTML(rec)}</div>
                        </div>
                    </div>
                `).join("");
            }
        })
        .catch(err => console.error(err));
}

function loadTeacherDashboard() {
    // 1. Fetch Teacher Stats
    fetch("/api/teacher/activity-stats")
        .then(res => res.json())
        .then(stats => {
            const quizzesCreatedEl = document.getElementById("dash-teacher-quizzes");
            const feedbacksGivenEl = document.getElementById("dash-teacher-feedbacks");
            const avgStudentScoreEl = document.getElementById("dash-teacher-student-avg");
            
            if (quizzesCreatedEl) quizzesCreatedEl.textContent = stats.quizzes_created;
            if (feedbacksGivenEl) feedbacksGivenEl.textContent = stats.feedback_submitted;
            if (avgStudentScoreEl) avgStudentScoreEl.textContent = `${stats.avg_score_on_quizzes.toFixed(1)}%`;
        })
        .catch(err => console.error("Error loading teacher dash stats:", err));

    // 2. Fetch recent teacher activities
    fetch("/api/teacher/activities")
        .then(res => res.json())
        .then(activities => {
            const activityBody = document.getElementById("teacher-recent-activities-body");
            if (activityBody) {
                if (activities.length === 0) {
                    activityBody.innerHTML = '<tr><td colspan="3">No recent activities found.</td></tr>';
                    return;
                }
                activityBody.innerHTML = activities.slice(0, 5).map(act => `
                    <tr>
                        <td><strong>${escapeHTML(act.action)}</strong></td>
                        <td>${escapeHTML(act.details)}</td>
                        <td>${formatDate(act.created_at)}</td>
                    </tr>
                `).join("");
            }
        })
        .catch(err => console.error(err));

    // 3. Fetch leaderboard teaser (Top 5 students platform-wide)
    const teaserEl = document.getElementById("dash-leaderboard-teaser");
    if (teaserEl) {
        fetch("/api/teacher/leaderboard/overall")
            .then(res => res.json())
            .then(leaderboard => {
                if (!leaderboard || leaderboard.length === 0) {
                    teaserEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No quiz attempts recorded yet.</p>';
                    return;
                }
                teaserEl.innerHTML = leaderboard.slice(0, 5).map(r => {
                    const avatarUrl = r.avatar ? `/uploads/avatars/${r.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=3b82f6&color=fff`;
                    return `
                        <div class="mini-leaderboard-row">
                            ${rankBadgeHTML(r.rank)}
                            <img src="${avatarUrl}" alt="" class="mini-leaderboard-avatar">
                            <div class="mini-leaderboard-info">
                                <div class="mini-leaderboard-name">${escapeHTML(r.name)}</div>
                                <div class="mini-leaderboard-meta">${r.total_attempts} attempts</div>
                            </div>
                            <div class="mini-leaderboard-score">${Number(r.avg_percent).toFixed(1)}%</div>
                        </div>
                    `;
                }).join("");
            })
            .catch(err => {
                console.error("Error loading leaderboard teaser:", err);
                teaserEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Unable to load leaderboard.</p>';
            });
    }
}

function loadAdminDashboard() {
    // 1. Fetch stats via admin analytics endpoint
    fetch("/api/admin/analytics")
        .then(res => res.json())
        .then(data => {
            // Aggregate values
            let students = 0, teachers = 0;
            data.users_by_role.forEach(u => {
                if (u.role === 'student') students = u.count;
                if (u.role === 'teacher') teachers = u.count;
            });

            const totalStudentsEl = document.getElementById("dash-admin-students");
            const totalTeachersEl = document.getElementById("dash-admin-teachers");
            const totalQuizzesEl = document.getElementById("dash-admin-quizzes");
            
            if (totalStudentsEl) totalStudentsEl.textContent = students;
            if (totalTeachersEl) totalTeachersEl.textContent = teachers;
            
            let totalQ = 0;
            data.quizzes_by_category.forEach(q => totalQ += q.count);
            if (totalQuizzesEl) totalQuizzesEl.textContent = totalQ;
        })
        .catch(err => console.error("Error loading admin stats:", err));

    // 2. Fetch System Activity Logs
    fetch("/api/admin/activity-logs")
        .then(res => res.json())
        .then(logs => {
            const logsBody = document.getElementById("admin-recent-logs-body");
            if (logsBody) {
                if (logs.length === 0) {
                    logsBody.innerHTML = '<tr><td colspan="4">No activity logs recorded.</td></tr>';
                    return;
                }
                logsBody.innerHTML = logs.slice(0, 5).map(log => `
                    <tr>
                        <td><span class="status-badge active" style="font-size:0.75rem;">${log.role}</span> <strong>${escapeHTML(log.name)}</strong></td>
                        <td><strong>${escapeHTML(log.action)}</strong></td>
                        <td>${escapeHTML(log.details)}</td>
                        <td>${formatDate(log.created_at)}</td>
                    </tr>
                `).join("");
            }
        })
        .catch(err => console.error(err));

    // 3. Fetch leaderboard teaser (Top 5 students platform-wide)
    const teaserEl = document.getElementById("dash-leaderboard-teaser");
    if (teaserEl) {
        fetch("/api/admin/leaderboard/overall")
            .then(res => res.json())
            .then(leaderboard => {
                if (!leaderboard || leaderboard.length === 0) {
                    teaserEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No quiz attempts recorded yet.</p>';
                    return;
                }
                teaserEl.innerHTML = leaderboard.slice(0, 5).map(r => {
                    const avatarUrl = r.avatar ? `/uploads/avatars/${r.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=3b82f6&color=fff`;
                    return `
                        <div class="mini-leaderboard-row">
                            ${rankBadgeHTML(r.rank)}
                            <img src="${avatarUrl}" alt="" class="mini-leaderboard-avatar">
                            <div class="mini-leaderboard-info">
                                <div class="mini-leaderboard-name">${escapeHTML(r.name)}</div>
                                <div class="mini-leaderboard-meta">${r.total_attempts} attempts</div>
                            </div>
                            <div class="mini-leaderboard-score">${Number(r.avg_percent).toFixed(1)}%</div>
                        </div>
                    `;
                }).join("");
            })
            .catch(err => {
                console.error("Error loading leaderboard teaser:", err);
                teaserEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Unable to load leaderboard.</p>';
            });
    }
}
