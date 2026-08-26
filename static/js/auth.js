// EduLearn Hub - Authentication & Profile Manager

document.addEventListener("DOMContentLoaded", () => {
    // Signup Form Handler
    initSignupForm();

    // Login Form Handler (with CAPTCHA and OTP options)
    initLoginForm();

    // Profile Settings Form
    initProfileSettings();
});

function initSignupForm() {
    const signupForm = document.getElementById("signup-form");
    if (!signupForm) return;

    signupForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("signup-name").value.strip ? document.getElementById("signup-name").value.trim() : document.getElementById("signup-name").value;
        const email = document.getElementById("signup-email").value.trim();
        const mobile = document.getElementById("signup-mobile").value.trim();
        const password = document.getElementById("signup-password").value;
        const confirmPassword = document.getElementById("signup-confirm-password").value;

        if (password !== confirmPassword) {
            showToast("Passwords do not match!", "error");
            return;
        }

        const payload = { name, email, mobile, password, role: 'student' };

        fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async (response) => {
            const data = await response.json();
            if (response.ok) {
                showToast("Account created! Redirecting to login...");
                setTimeout(() => window.location.href = "/login", 1500);
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

function initLoginForm() {
    const loginForm = document.getElementById("login-form");
    const captchaImg = document.getElementById("captcha-image-element");
    const refreshCaptchaBtn = document.getElementById("refresh-captcha-btn");
    
    // Toggle buttons
    const optLoginToggle = document.getElementById("toggle-otp-mode");
    const passwordLoginToggle = document.getElementById("toggle-password-mode");
    
    // Sections
    const passwordSection = document.getElementById("login-password-section");
    const captchaSection = document.getElementById("login-captcha-section");
    const otpSection = document.getElementById("login-otp-section");
    const sendOtpBtn = document.getElementById("send-otp-btn");

    // Role tabs
    const roleTabs = document.querySelectorAll(".login-role-tab");
    const roleInput = document.getElementById("login-role");
    const signupHint = document.getElementById("login-signup-hint");

    if (!loginForm) return;

    // State
    let isOtpMode = false;

    // Load captcha image on load
    if (captchaImg) {
        refreshCaptcha();
        refreshCaptchaBtn.addEventListener("click", refreshCaptcha);
        captchaImg.addEventListener("click", refreshCaptcha);
    }

    function refreshCaptcha() {
        captchaImg.src = "/api/captcha?t=" + new Date().getTime();
    }

    // Role Tab Switching - OTP login is a student-only convenience, so it's
    // hidden entirely when the Teacher or Admin tab is active.
    roleTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            roleTabs.forEach(t => {
                t.classList.remove("active");
                t.setAttribute("aria-selected", "false");
            });
            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");

            const role = tab.dataset.role;
            roleInput.value = role;

            if (role === "student") {
                optLoginToggle.style.display = isOtpMode ? "none" : "inline-block";
                if (signupHint) signupHint.style.display = "block";
            } else {
                // Force back to password mode for teacher/admin and hide OTP entirely
                if (isOtpMode) {
                    isOtpMode = false;
                    passwordSection.style.display = "block";
                    captchaSection.style.display = "block";
                    otpSection.style.display = "none";
                    passwordLoginToggle.style.display = "none";
                    refreshCaptcha();
                }
                optLoginToggle.style.display = "none";
                if (signupHint) signupHint.style.display = "none";
            }
        });
    });

    // Toggle Modes
    if (optLoginToggle && passwordLoginToggle) {
        optLoginToggle.addEventListener("click", () => {
            isOtpMode = true;
            passwordSection.style.display = "none";
            captchaSection.style.display = "none";
            otpSection.style.display = "block";
            optLoginToggle.style.display = "none";
            passwordLoginToggle.style.display = "inline-block";
        });

        passwordLoginToggle.addEventListener("click", () => {
            isOtpMode = false;
            passwordSection.style.display = "block";
            captchaSection.style.display = "block";
            otpSection.style.display = "none";
            optLoginToggle.style.display = "inline-block";
            passwordLoginToggle.style.display = "none";
            refreshCaptcha();
        });
    }

    // Send OTP
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener("click", () => {
            const email = document.getElementById("login-email").value.trim();
            if (!email) {
                showToast("Please enter your email first", "error");
                return;
            }

            fetch("/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            })
            .then(async (response) => {
                const data = await response.json();
                if (response.ok) {
                    showToast(data.message);
                } else {
                    showToast(data.error, "error");
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Error sending OTP", "error");
            });
        });
    }

    // Handle Form Submit
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const role = roleInput ? roleInput.value : "student";
        
        if (isOtpMode) {
            // OTP login submission
            const otp = document.getElementById("login-otp-code").value.trim();
            if (!otp) {
                showToast("Please enter the OTP", "error");
                return;
            }

            fetch("/api/login-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp, role })
            })
            .then(async (response) => {
                const data = await response.json();
                if (response.ok) {
                    showToast("Login successful!");
                    setTimeout(() => window.location.href = "/dashboard", 1000);
                } else {
                    showToast(data.error || "OTP login failed", "error");
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Network error", "error");
            });

        } else {
            // Standard password login
            const password = document.getElementById("login-password").value;
            const captcha = document.getElementById("login-captcha-val").value.trim();

            if (!password || !captcha) {
                showToast("Password and CAPTCHA are required", "error");
                return;
            }

            fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, captcha, role })
            })
            .then(async (response) => {
                const data = await response.json();
                if (response.ok) {
                    showToast("Login successful!");
                    setTimeout(() => window.location.href = "/dashboard", 1000);
                } else {
                    showToast(data.error || "Login failed", "error");
                    refreshCaptcha();
                    document.getElementById("login-captcha-val").value = "";
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Network error", "error");
            });
        }
    });
}

function initProfileSettings() {
    const profileForm = document.getElementById("profile-settings-form");
    const changePasswordForm = document.getElementById("profile-password-form");

    // Fetch and prefill profile data if profile fields exist
    const profileNameInput = document.getElementById("profile-name");
    if (profileNameInput) {
        fetch("/api/user/profile")
            .then(res => res.json())
            .then(profile => {
                document.getElementById("profile-name").value = profile.name;
                document.getElementById("profile-mobile").value = profile.mobile;
                document.getElementById("profile-email-readonly").value = profile.email;
                document.getElementById("profile-role-readonly").value = profile.role.toUpperCase();
                
                const avatarPreview = document.getElementById("profile-avatar-preview");
                if (avatarPreview && profile.avatar) {
                    avatarPreview.src = `/uploads/avatars/${profile.avatar}`;
                }
            })
            .catch(err => console.error("Error loading profile details:", err));
    }

    if (profileForm) {
        profileForm.addEventListener("submit", (e) => {
            e.preventDefault();

            // Profile update uses multipart/form-data for avatar upload
            const formData = new FormData();
            formData.append("name", document.getElementById("profile-name").value.trim());
            formData.append("mobile", document.getElementById("profile-mobile").value.trim());
            
            const avatarFile = document.getElementById("profile-avatar-file").files[0];
            if (avatarFile) {
                formData.append("avatar", avatarFile);
            }

            fetch("/api/user/profile", {
                method: "PUT",
                body: formData // Form data sets content-type automatically
            })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    showToast("Profile details updated successfully!");
                    if (data.avatar) {
                        const avatarPreview = document.getElementById("profile-avatar-preview");
                        const headerAvatar = document.querySelector(".avatar-img");
                        if (avatarPreview) avatarPreview.src = `/uploads/avatars/${data.avatar}?t=` + new Date().getTime();
                        if (headerAvatar) headerAvatar.src = `/uploads/avatars/${data.avatar}?t=` + new Date().getTime();
                    }
                } else {
                    showToast(data.error || "Update failed", "error");
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Error updating profile", "error");
            });
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const oldPassword = document.getElementById("profile-old-pass").value;
            const newPassword = document.getElementById("profile-new-pass").value;
            const confirmPassword = document.getElementById("profile-confirm-pass").value;

            if (newPassword !== confirmPassword) {
                showToast("New passwords do not match!", "error");
                return;
            }

            fetch("/api/user/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    showToast("Password updated successfully!");
                    changePasswordForm.reset();
                } else {
                    showToast(data.error || "Error changing password", "error");
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Network error", "error");
            });
        });
    }
}
