// EduLearn Hub - Chart.js Analytics Integrator

document.addEventListener("DOMContentLoaded", () => {
    // 1. Student analytics charts
    const studentAnalyticsCanvas = document.getElementById("student-score-trend-chart");
    if (studentAnalyticsCanvas) {
        loadStudentAnalyticsCharts();
    }

    // 2. Admin analytics charts
    const adminAnalyticsCanvas = document.getElementById("admin-user-roles-chart");
    if (adminAnalyticsCanvas) {
        loadAdminAnalyticsCharts();
    }
});

function loadStudentAnalyticsCharts() {
    const studentIdInput = document.getElementById("analytics-student-id");
    const studentId = studentIdInput ? studentIdInput.value : "";
    
    let url = "/api/student/analytics";
    if (studentId) url += `?student_id=${studentId}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            // General Stats Prefill if tags exist
            const avgScorePercentEl = document.getElementById("analytics-avg-percent");
            const totalQuizCountEl = document.getElementById("analytics-total-count");
            const highestScoreEl = document.getElementById("analytics-highest-score");
            
            if (avgScorePercentEl) {
                const avg = parseFloat(data.summary.avg_score);
                avgScorePercentEl.textContent = `${avg.toFixed(1)}%`;
            }
            if (totalQuizCountEl) {
                totalQuizCountEl.textContent = data.summary.total_attempts;
            }
            if (highestScoreEl) {
                highestScoreEl.textContent = `${data.summary.max_score} Marks`;
            }

            // A. Quiz Score Trends (Line Chart)
            const trendCtx = document.getElementById("student-score-trend-chart").getContext("2d");
            const labels = data.timeline.map((item, idx) => `Test ${idx + 1}`);
            const scores = data.timeline.map(item => (item.score / item.total_marks) * 100);
            
            new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Score Percentage (%)',
                        data: scores,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#8b5cf6',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#9ca3af' } }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: { color: '#9ca3af' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        x: {
                            ticks: { color: '#9ca3af' },
                            grid: { display: false }
                        }
                    }
                }
            });

            // B. Category Performance (Radar Chart)
            const catCtx = document.getElementById("student-category-perf-chart").getContext("2d");
            const catLabels = ["Railway", "SSC", "Banking"];
            
            // Map category data to matches
            const catDataMap = { "Railway": 0, "SSC": 0, "Banking": 0 };
            data.category_performance.forEach(c => {
                const percent = (c.avg_score / c.avg_total_marks) * 100;
                catDataMap[c.category] = percent;
            });
            const catValues = catLabels.map(label => catDataMap[label]);

            new Chart(catCtx, {
                type: 'radar',
                data: {
                    labels: catLabels,
                    datasets: [{
                        label: 'Average Score (%)',
                        data: catValues,
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        borderColor: '#8b5cf6',
                        pointBackgroundColor: '#06b6d4',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#9ca3af' } }
                    },
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            pointLabels: { color: '#9ca3af' },
                            ticks: { display: false, max: 100 },
                            min: 0,
                            max: 100
                        }
                    }
                }
            });

            // C. Difficulty Distribution (Doughnut Chart)
            const diffCtx = document.getElementById("student-difficulty-dist-chart").getContext("2d");
            const diffLabels = ["Easy", "Medium", "Hard"];
            
            const diffDataMap = { "Easy": 0, "Medium": 0, "Hard": 0 };
            data.difficulty_performance.forEach(d => {
                diffDataMap[d.difficulty] = d.attempts;
            });
            const diffValues = diffLabels.map(l => diffDataMap[l]);

            new Chart(diffCtx, {
                type: 'doughnut',
                data: {
                    labels: diffLabels,
                    datasets: [{
                        data: diffValues,
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#9ca3af' }
                        }
                    }
                }
            });
        })
        .catch(err => console.error(err));
}

function loadAdminAnalyticsCharts() {
    fetch("/api/admin/analytics")
        .then(res => res.json())
        .then(data => {
            // A. User Roles Distribution (Doughnut)
            const userCtx = document.getElementById("admin-user-roles-chart").getContext("2d");
            let studentCount = 0, teacherCount = 0, adminCount = 0;
            data.users_by_role.forEach(r => {
                if (r.role === 'student') studentCount = r.count;
                if (r.role === 'teacher') teacherCount = r.count;
                if (r.role === 'admin') adminCount = r.count;
            });

            new Chart(userCtx, {
                type: 'doughnut',
                data: {
                    labels: ["Students", "Teachers", "Admins"],
                    datasets: [{
                        data: [studentCount, teacherCount, adminCount],
                        backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4'],
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

            // B. Quizzes by Category (Bar Chart)
            const quizCtx = document.getElementById("admin-quiz-categories-chart").getContext("2d");
            const catLabels = ["Railway", "SSC", "Banking"];
            const catMap = { "Railway": 0, "SSC": 0, "Banking": 0 };
            data.quizzes_by_category.forEach(q => {
                catMap[q.category] = q.count;
            });
            const catValues = catLabels.map(l => catMap[l]);

            new Chart(quizCtx, {
                type: 'bar',
                data: {
                    labels: catLabels,
                    datasets: [{
                        label: 'Quizzes Created',
                        data: catValues,
                        backgroundColor: '#8b5cf6',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
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

            // C. Registration Timeline (Line)
            const regCtx = document.getElementById("admin-registrations-chart").getContext("2d");
            const regLabels = data.user_timeline.map(t => t.date);
            const regValues = data.user_timeline.map(t => t.count);

            new Chart(regCtx, {
                type: 'line',
                data: {
                    labels: regLabels,
                    datasets: [{
                        label: 'Signups',
                        data: regValues,
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#9ca3af' } }
                    },
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
        })
        .catch(err => console.error(err));
}
