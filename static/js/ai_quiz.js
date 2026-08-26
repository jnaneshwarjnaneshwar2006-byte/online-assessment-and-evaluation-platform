// EduLearn Hub - AI Quiz Generation Interface

document.addEventListener("DOMContentLoaded", () => {
    initAiQuizGenerator();
});

function initAiQuizGenerator() {
    const aiForm = document.getElementById("ai-quiz-generator-form");
    if (!aiForm) return;

    const generateBtn = document.getElementById("ai-generate-btn");
    const loaderContainer = document.getElementById("ai-generation-loader");

    aiForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const category = document.getElementById("ai-category").value;
        const difficulty = document.getElementById("ai-difficulty").value;
        const numQuestions = parseInt(document.getElementById("ai-num-questions").value) || 5;

        // Show spinner loader, disable button
        if (loaderContainer) loaderContainer.style.display = "flex";
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating via Gemini AI...';

        const payload = {
            category: category,
            difficulty: difficulty,
            num_questions: numQuestions
        };

        fetch("/api/ai-quiz/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast("AI Quiz generated successfully!");
                
                // Redirect depending on user role: if student, take it; if teacher, go back to dashboard
                const userRole = document.getElementById("user-role-val-holder") ? document.getElementById("user-role-val-holder").value : "student";
                
                setTimeout(() => {
                    if (userRole === 'teacher') {
                        window.location.href = "/teacher/dashboard";
                    } else {
                        window.location.href = `/student/quiz/attempt/${data.quiz_id}`;
                    }
                }, 1500);
            } else {
                showToast(data.error || "Gemini quiz generation failed.", "error");
                resetGeneratorButton();
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Network error during AI generation.", "error");
            resetGeneratorButton();
        });
    });

    function resetGeneratorButton() {
        if (loaderContainer) loaderContainer.style.display = "none";
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Exam Paper';
    }
}
