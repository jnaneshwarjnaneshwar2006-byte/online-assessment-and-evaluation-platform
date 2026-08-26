// EduLearn Hub - Dedicated Teacher & Admin Login Pages

document.addEventListener("DOMContentLoaded", () => {
    initPortalLogin({
        formId: "teacher-login-form",
        emailId: "teacher-login-email",
        passwordId: "teacher-login-password",
        captchaImgId: "teacher-captcha-image-element",
        refreshBtnId: "teacher-refresh-captcha-btn",
        captchaValId: "teacher-login-captcha-val",
        role: "teacher"
    });

    initPortalLogin({
        formId: "admin-login-form",
        emailId: "admin-login-email",
        passwordId: "admin-login-password",
        captchaImgId: "admin-captcha-image-element",
        refreshBtnId: "admin-refresh-captcha-btn",
        captchaValId: "admin-login-captcha-val",
        role: "admin"
    });

    initPortalModeTabs();
    initTeacherSignupForm();
});

// Login <-> Sign Up tab switching on the Teacher portal page
function initPortalModeTabs() {
    const tabs = document.querySelectorAll(".portal-mode-tab");
    const loginMode = document.getElementById("teacher-login-mode");
    const signupMode = document.getElementById("teacher-signup-mode");
    if (!tabs.length || !loginMode || !signupMode) return;

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => {
                t.classList.remove("active");
                t.setAttribute("aria-selected", "false");
            });
            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");

            if (tab.dataset.mode === "signup") {
                loginMode.style.display = "none";
                signupMode.style.display = "block";
            } else {
                loginMode.style.display = "block";
                signupMode.style.display = "none";
            }
        });
    });
}

// Teacher self-signup - creates a 'teacher' role account directly via /api/signup
function initTeacherSignupForm() {
    const form = document.getElementById("teacher-signup-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("teacher-signup-name").value.trim();
        const email = document.getElementById("teacher-signup-email").value.trim();
        const mobile = document.getElementById("teacher-signup-mobile").value.trim();
        const department = document.getElementById("teacher-signup-department").value.trim();
        const qualification = document.getElementById("teacher-signup-qualification").value.trim();
        const experience = document.getElementById("teacher-signup-experience").value.trim();
        const password = document.getElementById("teacher-signup-password").value;
        const confirmPassword = document.getElementById("teacher-signup-confirm-password").value;

        if (password !== confirmPassword) {
            showToast("Passwords do not match!", "error");
            return;
        }

        const payload = {
            name, email, mobile, password,
            role: "teacher",
            department, qualification, experience
        };

        fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async (response) => {
            const data = await response.json();
            if (response.ok) {
                showToast("Teacher account created! You can now log in.");
                form.reset();
                // Switch back to the login tab
                const loginTab = document.querySelector('.portal-mode-tab[data-mode="login"]');
                if (loginTab) loginTab.click();
            } else {
                showToast(data.error || "Signup failed", "error");
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Network error. Try again later.", "error");
        });
    });
}

function initPortalLogin(cfg) {
    const form = document.getElementById(cfg.formId);
    if (!form) return;

    const captchaImg = document.getElementById(cfg.captchaImgId);
    const refreshBtn = document.getElementById(cfg.refreshBtnId);

    function refreshCaptcha() {
        if (captchaImg) captchaImg.src = "/api/captcha?t=" + new Date().getTime();
    }

    refreshCaptcha();
    if (refreshBtn) refreshBtn.addEventListener("click", refreshCaptcha);
    if (captchaImg) captchaImg.addEventListener("click", refreshCaptcha);

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const email = document.getElementById(cfg.emailId).value.trim();
        const password = document.getElementById(cfg.passwordId).value;
        const captcha = document.getElementById(cfg.captchaValId).value.trim();

        if (!email || !password || !captcha) {
            showToast("All fields are required", "error");
            return;
        }

        fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, captcha, role: cfg.role })
        })
        .then(async (response) => {
            const data = await response.json();
            if (response.ok) {
                showToast("Login successful!");
                setTimeout(() => window.location.href = "/dashboard", 1000);
            } else {
                showToast(data.error || "Login failed", "error");
                refreshCaptcha();
                document.getElementById(cfg.captchaValId).value = "";
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Network error", "error");
        });
    });
}
