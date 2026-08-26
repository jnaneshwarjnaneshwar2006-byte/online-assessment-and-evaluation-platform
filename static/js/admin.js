// EduLearn Hub - Admin Panel Actions

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check if we are on Students List page
    initAdminStudentsPage();

    // 2. Check if we are on Teachers List page
    initAdminTeachersPage();

    // 3. Check if we are on Create Teacher page
    initCreateTeacherForm();

    // 4. Check if we are on Edit Teacher page
    initEditTeacherForm();

    // 5. Check if we are on Blocked Users page
    initBlockedUsersPage();

    // 6. Check if we are on Activity Logs page
    initActivityLogsPage();
});

// Admin Student List
function initAdminStudentsPage() {
    const listBody = document.getElementById("admin-students-list-body");
    if (!listBody) return;

    fetchStudents();

    function fetchStudents() {
        fetch("/api/admin/students")
            .then(res => res.json())
            .then(students => {
                if (students.length === 0) {
                    listBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No students found.</td></tr>';
                    return;
                }

                listBody.innerHTML = students.map((stu, idx) => `
                    <tr class="fade-in-el">
                        <td>${idx + 1}</td>
                        <td><strong>${escapeHTML(stu.name)}</strong></td>
                        <td>${stu.user_id}</td>
                        <td>${escapeHTML(stu.email)}</td>
                        <td><span class="status-badge ${stu.status}">${stu.status}</span></td>
                        <td>
                            <button onclick="toggleUserStatus('${stu.user_id}', '${stu.status}')" class="btn ${stu.status === 'active' ? 'btn-danger' : 'btn-primary'}" style="padding: 4px 10px; font-size: 0.8rem;">
                                ${stu.status === 'active' ? 'Block' : 'Unblock'}
                            </button>
                        </td>
                    </tr>
                `).join("");
            })
            .catch(err => console.error(err));
    }

    window.toggleUserStatus = function(userId, currentStatus) {
        const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
        const msg = `Are you sure you want to change user status for ${userId} to ${nextStatus.toUpperCase()}?`;
        
        if (confirm(msg)) {
            fetch(`/api/admin/user/${userId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            })
            .then(async res => {
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message);
                    fetchStudents();
                } else {
                    showToast(data.error || "Update failed", "error");
                }
            })
            .catch(err => console.error(err));
        }
    };
}

// Admin Teacher List
function initAdminTeachersPage() {
    const listBody = document.getElementById("admin-teachers-list-body");
    if (!listBody) return;

    fetchTeachers();

    function fetchTeachers() {
        fetch("/api/admin/teachers")
            .then(res => res.json())
            .then(teachers => {
                if (teachers.length === 0) {
                    listBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No teachers registered yet.</td></tr>';
                    return;
                }

                listBody.innerHTML = teachers.map((tch, idx) => `
                    <tr class="fade-in-el">
                        <td>${idx + 1}</td>
                        <td><strong>${escapeHTML(tch.name)}</strong></td>
                        <td>${tch.user_id}</td>
                        <td>${escapeHTML(tch.email)}</td>
                        <td>${escapeHTML(tch.department)}</td>
                        <td>${escapeHTML(tch.experience)}</td>
                        <td><span class="status-badge ${tch.status}">${tch.status}</span></td>
                        <td>
                            <div class="user-card-actions">
                                <a href="/admin/edit-teacher/${tch.user_id}" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fas fa-edit"></i></a>
                                <button onclick="resetTeacherPassword('${tch.user_id}')" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" title="Reset Password"><i class="fas fa-key"></i></button>
                                <button onclick="toggleTeacherStatus('${tch.user_id}', '${tch.status}')" class="btn ${tch.status === 'active' ? 'btn-danger' : 'btn-primary'}" style="padding: 4px 8px; font-size: 0.75rem;">
                                    ${tch.status === 'active' ? 'Block' : 'Unblock'}
                                </button>
                                <button onclick="deleteTeacher('${tch.user_id}')" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join("");
            })
            .catch(err => console.error(err));
    }

    window.toggleTeacherStatus = function(userId, status) {
        const nextStatus = status === 'active' ? 'blocked' : 'active';
        fetch(`/api/admin/user/${userId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus })
        })
        .then(() => {
            showToast("Teacher status updated");
            fetchTeachers();
        })
        .catch(err => console.error(err));
    };

    window.resetTeacherPassword = function(userId) {
        const newPass = prompt("Enter new password for this teacher account:");
        if (newPass) {
            fetch(`/api/admin/teacher/${userId}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPass })
            })
            .then(async res => {
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message);
                } else {
                    showToast(data.error || "Reset failed", "error");
                }
            })
            .catch(err => console.error(err));
        }
    };

    window.deleteTeacher = function(userId) {
        if (confirm("Are you sure you want to permanently delete this teacher account? This action cannot be undone.")) {
            fetch(`/api/admin/teacher/${userId}`, { method: "DELETE" })
                .then(async res => {
                    const data = await res.json();
                    if (res.ok) {
                        showToast(data.message);
                        fetchTeachers();
                    } else {
                        showToast(data.error || "Delete failed", "error");
                    }
                })
                .catch(err => console.error(err));
        }
    };
}

// Onboard Teacher
function initCreateTeacherForm() {
    const form = document.getElementById("admin-create-teacher-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("tch-name").value.trim();
        const email = document.getElementById("tch-email").value.trim();
        const mobile = document.getElementById("tch-mobile").value.trim();
        const password = document.getElementById("tch-password").value;
        const department = document.getElementById("tch-department").value.trim();
        const qualification = document.getElementById("tch-qualification").value.trim();
        const experience = document.getElementById("tch-experience").value.trim();

        const payload = {
            name, email, mobile, password, department, qualification, experience
        };

        fetch("/api/admin/create-teacher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast("Teacher onboarding successful!");
                setTimeout(() => window.location.href = "/admin/teachers", 1000);
            } else {
                showToast(data.error || "Onboarding failed", "error");
            }
        })
        .catch(err => console.error(err));
    });
}

// Edit Teacher details
function initEditTeacherForm() {
    const form = document.getElementById("admin-edit-teacher-form");
    if (!form) return;

    const teacherId = document.getElementById("edit-teacher-id").value;

    // Load teacher current details
    fetch("/api/admin/teachers")
        .then(res => res.json())
        .then(teachers => {
            const tch = teachers.find(t => t.user_id === teacherId);
            if (tch) {
                document.getElementById("tch-name").value = tch.name;
                document.getElementById("tch-mobile").value = tch.mobile;
                document.getElementById("tch-department").value = tch.department;
                document.getElementById("tch-qualification").value = tch.qualification;
                document.getElementById("tch-experience").value = tch.experience;
            }
        })
        .catch(err => console.error(err));

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const payload = {
            name: document.getElementById("tch-name").value.trim(),
            mobile: document.getElementById("tch-mobile").value.trim(),
            department: document.getElementById("tch-department").value.trim(),
            qualification: document.getElementById("tch-qualification").value.trim(),
            experience: document.getElementById("tch-experience").value.trim()
        };

        fetch(`/api/admin/teacher/${teacherId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast("Teacher details updated successfully!");
                setTimeout(() => window.location.href = "/admin/teachers", 1000);
            } else {
                showToast(data.error || "Update failed", "error");
            }
        })
        .catch(err => console.error(err));
    });
}

// Blocked users
function initBlockedUsersPage() {
    const listBody = document.getElementById("admin-blocked-list-body");
    if (!listBody) return;

    fetchBlockedUsers();

    function fetchBlockedUsers() {
        // We will fetch students + teachers and filter for blocked status
        Promise.all([
            fetch("/api/admin/students").then(res => res.json()),
            fetch("/api/admin/teachers").then(res => res.json())
        ])
        .then(([students, teachers]) => {
            const blocked = [
                ...students.filter(s => s.status === 'blocked'),
                ...teachers.filter(t => t.status === 'blocked')
            ];

            if (blocked.length === 0) {
                listBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No accounts are blocked.</td></tr>';
                return;
            }

            listBody.innerHTML = blocked.map((user, idx) => `
                <tr class="fade-in-el">
                    <td>${idx + 1}</td>
                    <td><strong>${escapeHTML(user.name)}</strong></td>
                    <td>${user.user_id}</td>
                    <td>${escapeHTML(user.email)}</td>
                    <td><span class="status-badge blocked">${user.status}</span></td>
                    <td>
                        <button onclick="unblockUser('${user.user_id}')" class="btn btn-primary" style="padding: 4px 10px; font-size: 0.8rem;">
                            Unblock Account
                        </button>
                    </td>
                </tr>
            `).join("");
        })
        .catch(err => console.error(err));
    }

    window.unblockUser = function(userId) {
        fetch(`/api/admin/user/${userId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "active" })
        })
        .then(() => {
            showToast("Account unblocked successfully");
            fetchBlockedUsers();
        })
        .catch(err => console.error(err));
    };
}

// System Logs
function initActivityLogsPage() {
    const logsContainer = document.getElementById("admin-logs-console");
    if (!logsContainer) return;

    fetch("/api/admin/activity-logs")
        .then(res => res.json())
        .then(logs => {
            if (logs.length === 0) {
                logsContainer.innerHTML = '<div class="log-row">No activity logs recorded in the system.</div>';
                return;
            }

            logsContainer.innerHTML = logs.map(log => `
                <div class="log-row">
                    <span class="log-timestamp">[${new Date(log.created_at).toISOString()}]</span> 
                    <span class="log-user">${escapeHTML(log.name)} (${log.user_id}:${log.role})</span>: 
                    <span class="log-action">${escapeHTML(log.action)}</span> - 
                    <span class="log-details">${escapeHTML(log.details)}</span> 
                    <small style="color:var(--text-muted)">[IP: ${log.ip_address}]</small>
                </div>
            `).join("");
            
            // Scroll to bottom
            logsContainer.scrollTop = logsContainer.scrollHeight;
        })
        .catch(err => console.error(err));
}
