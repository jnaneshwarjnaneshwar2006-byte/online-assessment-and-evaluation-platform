// EduLearn Hub - Teacher Management Interface

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check if we are on Students List page
    initStudentsListPage();

    // 2. Check if we are on Student Detail page
    initStudentDetailPage();

    // 3. Check if we are on Manual Quiz Creator page
    initManualQuizCreator();
});

function initStudentsListPage() {
    const listBody = document.getElementById("teacher-students-list-body");
    if (!listBody) return;

    fetch("/api/teacher/students")
        .then(res => res.json())
        .then(students => {
            if (students.length === 0) {
                listBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No students registered yet.</td></tr>';
                return;
            }

            listBody.innerHTML = students.map((stu, idx) => `
                <tr class="fade-in-el">
                    <td>${idx + 1}</td>
                    <td><strong>${escapeHTML(stu.name)}</strong><br><small style="color:var(--text-muted)">${stu.user_id}</small></td>
                    <td>${escapeHTML(stu.email)}</td>
                    <td>${stu.total_attempts} Exams</td>
                    <td><span class="status-badge ${stu.avg_score >= 60 ? 'active' : 'warning'}">${stu.avg_score.toFixed(1)}%</span></td>
                    <td>
                        <a href="/teacher/student/${stu.user_id}" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">View Profile</a>
                    </td>
                </tr>
            `).join("");
        })
        .catch(err => console.error("Error loading student list:", err));
}

function initStudentDetailPage() {
    const detailContainer = document.getElementById("teacher-student-detail-view");
    if (!detailContainer) return;

    const studentId = document.getElementById("target-student-id").value;
    
    // Load student data
    fetchStudentDetails();

    // Feedback Submit Handler
    const feedbackForm = document.getElementById("teacher-submit-feedback-form");
    if (feedbackForm) {
        feedbackForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const title = document.getElementById("fb-title").value.trim();
            const message = document.getElementById("fb-message").value.trim();
            const feedbackType = document.getElementById("fb-type").value;
            const topic = document.getElementById("fb-topic").value.trim();

            const payload = {
                student_id: studentId,
                feedback_type: feedbackType,
                title: title,
                message: message,
                topic: topic
            };

            fetch("/api/teacher/add-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            .then(async res => {
                const data = await res.json();
                if (res.ok) {
                    showToast("Feedback submitted successfully!");
                    feedbackForm.reset();
                    fetchStudentDetails(); // Reload feeds
                } else {
                    showToast(data.error || "Failed to submit feedback", "error");
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Network error submitting feedback", "error");
            });
        });
    }

    function fetchStudentDetails() {
        fetch(`/api/teacher/student/${studentId}`)
            .then(res => res.json())
            .then(data => {
                const student = data.student;
                const attempts = data.attempts;
                const feedbacks = data.feedbacks;

                // Bind student profile summary details
                document.getElementById("stu-name").textContent = student.name;
                document.getElementById("stu-email").textContent = student.email;
                document.getElementById("stu-mobile").textContent = student.mobile;
                document.getElementById("stu-joined").textContent = formatDate(student.created_at);
                
                const avatarImg = document.getElementById("stu-avatar-img");
                if (avatarImg && student.avatar) {
                    avatarImg.src = `/uploads/avatars/${student.avatar}`;
                }

                // Bind attempts table
                const attemptsBody = document.getElementById("stu-attempts-table-body");
                if (attemptsBody) {
                    if (attempts.length === 0) {
                        attemptsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No quiz attempts recorded for this student.</td></tr>';
                    } else {
                        attemptsBody.innerHTML = attempts.map(att => `
                            <tr>
                                <td><strong>${escapeHTML(att.title)}</strong></td>
                                <td><span class="category-tag ${att.category.toLowerCase()}">${att.category}</span></td>
                                <td><span class="difficulty-badge ${att.difficulty.toLowerCase()}">${att.difficulty}</span></td>
                                <td><strong>${att.score} / ${att.total_marks}</strong></td>
                                <td>${formatDate(att.completed_at)}</td>
                            </tr>
                        `).join("");
                    }
                }

                // Bind past feedback list
                const feedbackList = document.getElementById("stu-past-feedback-list");
                if (feedbackList) {
                    if (feedbacks.length === 0) {
                        feedbackList.innerHTML = '<div style="color:var(--text-muted);">No feedback history for this student.</div>';
                    } else {
                        feedbackList.innerHTML = feedbacks.map(fb => `
                            <div class="notification-item" style="background:rgba(255,255,255,0.01)">
                                <div class="notif-icon feedback"><i class="fas fa-comment-dots"></i></div>
                                <div class="notif-details">
                                    <div class="notif-title">${escapeHTML(fb.title)} <small style="color:var(--text-muted); float:right;">${formatDate(fb.created_at)}</small></div>
                                    <div class="notif-desc">${escapeHTML(fb.message)}</div>
                                    <div style="margin-top:6px;"><span class="status-badge active" style="font-size:0.7rem;">Topic: ${escapeHTML(fb.topic || 'General')}</span></div>
                                </div>
                            </div>
                        `).join("");
                    }
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Error loading student details", "error");
            });
    }
}

// Manual Quiz Creator Logic
function initManualQuizCreator() {
    const creatorForm = document.getElementById("manual-quiz-creator-form");
    if (!creatorForm) return;

    const questionsList = document.getElementById("questions-builder-list");
    const addQuestionBtn = document.getElementById("add-question-card-btn");

    let questionCount = 0;

    // Add first question on load
    addQuestionCard();

    addQuestionBtn.addEventListener("click", addQuestionCard);

    creatorForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const title = document.getElementById("quiz-title").value.strip ? document.getElementById("quiz-title").value.trim() : document.getElementById("quiz-title").value;
        const category = document.getElementById("quiz-category").value;
        const difficulty = document.getElementById("quiz-difficulty").value;
        const duration = parseInt(document.getElementById("quiz-duration").value);

        // Collect questions
        const questions = [];
        const questionCards = document.querySelectorAll(".question-builder-card");

        let hasError = false;

        questionCards.forEach(card => {
            const qNum = card.dataset.qNum;
            const qText = card.querySelector(`.q-text-input`).value.trim();
            const optionInputs = card.querySelectorAll(`.opt-text-input`);
            const correctRadio = card.querySelector(`input[name="correct-opt-${qNum}"]:checked`);
            const explanation = card.querySelector(`.q-explain-input`).value.trim();

            if (!qText) {
                showToast("All questions must have question text!", "error");
                hasError = true;
                return;
            }

            const options = [];
            optionInputs.forEach(opt => {
                if (opt.value.trim()) options.push(opt.value.trim());
            });

            if (options.length < 2) {
                showToast("Each question must have at least 2 options!", "error");
                hasError = true;
                return;
            }

            if (!correctRadio) {
                showToast("Please pick a correct answer for each question!", "error");
                hasError = true;
                return;
            }

            // Correct choice index
            const correctIndex = parseInt(correctRadio.value);
            const correct_answer = options[correctIndex];

            questions.push({
                question_text: qText,
                options: options,
                correct_answer: correct_answer,
                marks: 10,
                explanation: explanation
            });
        });

        if (hasError) return;

        const payload = {
            title,
            category,
            difficulty,
            duration,
            questions
        };

        fetch("/api/quiz/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast("Quiz created successfully!");
                setTimeout(() => {
                    window.location.href = "/teacher/dashboard";
                }, 1000);
            } else {
                showToast(data.error || "Failed to create quiz", "error");
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Network error creating quiz", "error");
        });
    });

    function addQuestionCard() {
        const idx = questionCount++;
        const card = document.createElement("div");
        card.className = "glass-panel question-builder-card fade-in-el";
        card.dataset.qNum = idx;
        
        card.innerHTML = `
            <button type="button" class="remove-question-btn" onclick="removeQuestionCard(this)"><i class="fas fa-trash"></i></button>
            <h4 style="margin-bottom:15px; color:var(--primary);">Question ${idx + 1}</h4>
            
            <div class="form-group">
                <label class="form-label">Question Text</label>
                <textarea class="form-control q-text-input" rows="2" placeholder="Enter question contents..." required></textarea>
            </div>
            
            <label class="form-label" style="display:block; margin-bottom:8px;">Options (Check the radio button for the correct answer)</label>
            <div class="option-builder-group">
                <input type="radio" name="correct-opt-${idx}" value="0" class="option-radio" required>
                <input type="text" class="form-control opt-text-input" placeholder="Option A" required>
            </div>
            <div class="option-builder-group">
                <input type="radio" name="correct-opt-${idx}" value="1" class="option-radio">
                <input type="text" class="form-control opt-text-input" placeholder="Option B" required>
            </div>
            <div class="option-builder-group">
                <input type="radio" name="correct-opt-${idx}" value="2" class="option-radio">
                <input type="text" class="form-control opt-text-input" placeholder="Option C" required>
            </div>
            <div class="option-builder-group">
                <input type="radio" name="correct-opt-${idx}" value="3" class="option-radio">
                <input type="text" class="form-control opt-text-input" placeholder="Option D" required>
            </div>
            
            <div class="form-group" style="margin-top:15px; margin-bottom:0;">
                <label class="form-label">Solution Explanation</label>
                <textarea class="form-control q-explain-input" rows="2" placeholder="Explain why this answer is correct..."></textarea>
            </div>
        `;
        
        questionsList.appendChild(card);
        reindexQuestionCards();
    }

    window.removeQuestionCard = function(btn) {
        const card = btn.closest(".question-builder-card");
        card.remove();
        reindexQuestionCards();
    };

    function reindexQuestionCards() {
        const cards = document.querySelectorAll(".question-builder-card");
        cards.forEach((card, i) => {
            card.querySelector("h4").textContent = `Question ${i + 1}`;
            // Adjust radio group names
            const oldIdx = card.dataset.qNum;
            card.dataset.qNum = i;
            const radios = card.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.name = `correct-opt-${i}`;
            });
        });
        
        // Hide delete button if only 1 card left
        const deleteButtons = document.querySelectorAll(".remove-question-btn");
        if (cards.length <= 1) {
            deleteButtons.forEach(b => b.style.display = "none");
        } else {
            deleteButtons.forEach(b => b.style.display = "block");
        }
    }
}
