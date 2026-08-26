// EduLearn Hub - Core Frontend Logic

document.addEventListener("DOMContentLoaded", () => {
    // Theme Manager
    initTheme();

    // Setup Notification Drawer
    initNotifications();

    // Profile Dropdown Toggle
    initProfileDropdown();
});

// Theme Toggle logic
function initTheme() {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (!themeToggleBtn) return;

    // Check localStorage or browser pref
    const savedTheme = localStorage.getItem("edulearn-theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.remove("light-theme");
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeToggleBtn.addEventListener("click", () => {
        if (document.body.classList.contains("light-theme")) {
            document.body.classList.remove("light-theme");
            localStorage.setItem("edulearn-theme", "dark");
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.add("light-theme");
            localStorage.setItem("edulearn-theme", "light");
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    });
}

// User Notifications Fetch & Populator
function initNotifications() {
    const notifBell = document.getElementById("notif-bell-btn");
    const notifCount = document.getElementById("notif-count-badge");
    const notifDropdown = document.getElementById("notif-dropdown-menu");
    
    if (!notifBell || !notifCount || !notifDropdown) return;

    // Fetch and populate notifications
    fetchNotifications();

    // Toggle menu
    notifBell.addEventListener("click", (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => {
        notifDropdown.classList.remove("show");
    });
}

function fetchNotifications() {
    const notifCount = document.getElementById("notif-count-badge");
    const notifList = document.getElementById("notif-items-list");
    if (!notifList) return;

    fetch("/api/notifications")
        .then(response => {
            if (response.status === 401) return []; // Not logged in
            return response.json();
        })
        .then(notifs => {
            const unread = notifs.filter(n => n.is_read === 0);
            
            // Update badge count
            if (unread.length > 0) {
                notifCount.textContent = unread.length;
                notifCount.style.display = "flex";
            } else {
                notifCount.style.display = "none";
            }

            if (notifs.length === 0) {
                notifList.innerHTML = '<div class="no-notifs">No notifications found</div>';
                return;
            }

            notifList.innerHTML = notifs.map(notif => `
                <div class="notification-item ${notif.is_read === 0 ? 'unread' : ''}" onclick="readNotification(${notif.id})">
                    <div class="notif-icon ${notif.type}"><i class="${getNotifIcon(notif.type)}"></i></div>
                    <div class="notif-details">
                        <div class="notif-title">${escapeHTML(notif.title)}</div>
                        <div class="notif-desc">${escapeHTML(notif.message)}</div>
                        <div class="notif-time">${formatDate(notif.created_at)}</div>
                    </div>
                </div>
            `).join("");
        })
        .catch(err => console.error("Error loading notifications:", err));
}

function readNotification(notifId) {
    fetch(`/api/notifications/read/${notifId}`, { method: 'POST' })
        .then(() => fetchNotifications())
        .catch(err => console.error(err));
}

function getNotifIcon(type) {
    switch (type) {
        case 'feedback': return 'fas fa-comment-dots';
        case 'alert': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
    }
}

// Dropdown utility
function initProfileDropdown() {
    const trigger = document.getElementById("profile-dropdown-trigger");
    const menu = document.getElementById("profile-dropdown-menu");
    if (!trigger || !menu) return;

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("show");
    });

    document.addEventListener("click", () => {
        menu.classList.remove("show");
    });
}

// Unified toast notification popup creator
function showToast(message, type = "success") {
    // Remove existing toast if any
    const oldToast = document.querySelector(".toast-popup");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = `toast-popup alert alert-${type === 'error' ? 'danger' : 'success'} fade-in-el`;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    toast.style.minWidth = "250px";
    toast.style.boxShadow = "var(--shadow-premium)";

    const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHTML(message)}</span>`;
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.5s";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// Helpers
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
}

// Renders a small circular rank badge - gold/silver/bronze for top 3, plain number otherwise.
// Used across teacher/admin leaderboard, quiz results and dashboard widgets.
function rankBadgeHTML(rank) {
    let cls = "rank-badge";
    if (rank === 1) cls += " top-1";
    else if (rank === 2) cls += " top-2";
    else if (rank === 3) cls += " top-3";
    const icon = rank <= 3 ? '<i class="fas fa-trophy"></i>' : rank;
    return `<span class="${cls}">${icon}</span>`;
}

function truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
