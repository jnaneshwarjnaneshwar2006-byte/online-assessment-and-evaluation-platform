import random
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash
from backend.database import execute_query, execute_update
from backend.decorators import login_required, admin_required

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/api/admin/students', methods=['GET'])
@login_required
@admin_required
def admin_students():
    # List all student users
    query = """
        SELECT id, user_id, name, email, mobile, status, created_at 
        FROM users 
        WHERE role = 'student' 
        ORDER BY created_at DESC
    """
    students = execute_query(query)
    return jsonify(students), 200

@admin_bp.route('/api/admin/teachers', methods=['GET'])
@login_required
@admin_required
def admin_teachers():
    # List all teachers with their details
    query = """
        SELECT u.id, u.user_id, u.name, u.email, u.mobile, u.status, u.created_at, 
               t.department, t.qualification, t.experience
        FROM users u
        JOIN teachers t ON u.user_id = t.user_id
        WHERE u.role = 'teacher'
        ORDER BY u.created_at DESC
    """
    teachers = execute_query(query)
    return jsonify(teachers), 200

@admin_bp.route('/api/admin/create-teacher', methods=['POST'])
@login_required
@admin_required
def create_teacher():
    admin_id = session['user']['user_id']
    data = request.get_json() or {}
    
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    mobile = data.get('mobile', '').strip()
    password = data.get('password', '')
    
    department = data.get('department', '').strip()
    qualification = data.get('qualification', '').strip()
    experience = data.get('experience', '').strip()

    if not name or not email or not mobile or not password or not department or not qualification or not experience:
        return jsonify({"error": "All fields are required"}), 400

    # Check if email exists
    existing = execute_query("SELECT id FROM users WHERE email = %s", (email,), fetch_all=False)
    if existing:
        return jsonify({"error": "Email is already registered"}), 409

    # Generate teacher user_id
    while True:
        candidate_id = f"TCH{random.randint(100000, 999999)}"
        exists = execute_query("SELECT id FROM users WHERE user_id = %s", (candidate_id,), fetch_all=False)
        if not exists:
            teacher_id = candidate_id
            break

    hashed_pw = generate_password_hash(password)
    try:
        # Insert user
        execute_update(
            "INSERT INTO users (user_id, name, email, mobile, password, role, status, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (teacher_id, name, email, mobile, hashed_pw, 'teacher', 'active', admin_id)
        )
        # Insert teacher details
        execute_update(
            "INSERT INTO teachers (user_id, teacher_id, department, qualification, experience, created_by) VALUES (%s, %s, %s, %s, %s, %s)",
            (teacher_id, teacher_id, department, qualification, experience, admin_id)
        )
        
        # Log action
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (admin_id, "Create Teacher", f"Created teacher: {name} ({email})", request.remote_addr)
        )
        
        return jsonify({"message": "Teacher account created successfully!", "teacher_id": teacher_id}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create teacher: {str(e)}"}), 500

@admin_bp.route('/api/admin/teacher/<id>', methods=['PUT', 'DELETE'])
@login_required
@admin_required
def update_or_delete_teacher(id):
    # 'id' is the user_id of the teacher
    admin_id = session['user']['user_id']
    
    # Check if exists
    teacher = execute_query("SELECT * FROM users WHERE user_id = %s AND role = 'teacher'", (id,), fetch_all=False)
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    if request.method == 'PUT':
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        mobile = data.get('mobile', '').strip()
        department = data.get('department', '').strip()
        qualification = data.get('qualification', '').strip()
        experience = data.get('experience', '').strip()

        if not name or not mobile or not department or not qualification or not experience:
            return jsonify({"error": "All fields are required"}), 400

        try:
            execute_update(
                "UPDATE users SET name = %s, mobile = %s WHERE user_id = %s",
                (name, mobile, id)
            )
            execute_update(
                "UPDATE teachers SET department = %s, qualification = %s, experience = %s WHERE user_id = %s",
                (department, qualification, experience, id)
            )
            
            execute_update(
                "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
                (admin_id, "Update Teacher", f"Updated details for teacher: {id}", request.remote_addr)
            )
            return jsonify({"message": "Teacher details updated successfully!"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'DELETE':
        try:
            # Deleting from users will cascade to teachers table due to Foreign Key ON DELETE CASCADE
            execute_update("DELETE FROM users WHERE user_id = %s", (id,))
            
            execute_update(
                "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
                (admin_id, "Delete Teacher", f"Deleted teacher account: {id}", request.remote_addr)
            )
            return jsonify({"message": "Teacher account deleted successfully!"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/admin/user/<id>/status', methods=['PUT'])
@login_required
@admin_required
def update_user_status(id):
    # Block or unblock a user
    admin_id = session['user']['user_id']
    data = request.get_json() or {}
    status = data.get('status', 'active') # 'active' or 'blocked'

    if status not in ['active', 'blocked']:
        return jsonify({"error": "Invalid status"}), 400

    # Ensure admin is not blocking themselves
    if id == admin_id:
        return jsonify({"error": "You cannot block yourself"}), 400

    user = execute_query("SELECT name, role FROM users WHERE user_id = %s", (id,), fetch_all=False)
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        execute_update("UPDATE users SET status = %s WHERE user_id = %s", (status, id))
        
        # Log action
        action_name = "Block User" if status == 'blocked' else "Unblock User"
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (admin_id, action_name, f"{action_name}ed: {user['name']} ({id})", request.remote_addr)
        )
        return jsonify({"message": f"User status updated to {status} successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/admin/teacher/<id>/reset-password', methods=['POST'])
@login_required
@admin_required
def reset_teacher_password(id):
    admin_id = session['user']['user_id']
    data = request.get_json() or {}
    new_password = data.get('password', '')

    if not new_password:
        return jsonify({"error": "New password is required"}), 400

    user = execute_query("SELECT name FROM users WHERE user_id = %s AND role = 'teacher'", (id,), fetch_all=False)
    if not user:
        return jsonify({"error": "Teacher not found"}), 404

    try:
        hashed_pw = generate_password_hash(new_password)
        execute_update("UPDATE users SET password = %s WHERE user_id = %s", (hashed_pw, id))
        
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (admin_id, "Reset Teacher Password", f"Reset password for teacher: {user['name']} ({id})", request.remote_addr)
        )
        return jsonify({"message": "Teacher password reset successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/admin/activity-logs', methods=['GET'])
@login_required
@admin_required
def admin_activity_logs():
    # Fetch all logs joined with user names
    query = """
        SELECT al.id, al.user_id, al.action, al.details, al.ip_address, al.created_at, u.name, u.role
        FROM activity_logs al
        JOIN users u ON al.user_id = u.user_id
        ORDER BY al.created_at DESC
        LIMIT 100
    """
    logs = execute_query(query)
    return jsonify(logs), 200

# ----------------------------------------------------------------------
# QUIZ RESULTS OVERVIEW (admin) - every quiz created by every teacher,
# with aggregate performance, regardless of who created it.
# ----------------------------------------------------------------------
@admin_bp.route('/api/admin/quizzes-overview', methods=['GET'])
@login_required
@admin_required
def admin_quizzes_overview():
    query = """
        SELECT q.quiz_id, q.title, q.category, q.difficulty, q.total_marks,
               q.total_questions, q.duration, q.created_at,
               q.created_by, u.name as creator_name, u.role as creator_role,
               COUNT(qa.id) as total_attempts,
               COALESCE(AVG(qa.score), 0) as avg_score,
               COALESCE(MAX(qa.score), 0) as highest_score,
               COALESCE(MIN(qa.score), 0) as lowest_score
        FROM quizzes q
        JOIN users u ON q.created_by = u.user_id
        LEFT JOIN quiz_attempts qa ON q.quiz_id = qa.quiz_id
        GROUP BY q.quiz_id, q.title, q.category, q.difficulty, q.total_marks,
                 q.total_questions, q.duration, q.created_at, q.created_by,
                 u.name, u.role
        ORDER BY q.created_at DESC
    """
    quizzes = execute_query(query)
    return jsonify(quizzes), 200

# ----------------------------------------------------------------------
# QUIZ RESULTS OVERVIEW (admin) - every attempt for one specific quiz,
# regardless of which teacher created it.
# ----------------------------------------------------------------------
@admin_bp.route('/api/admin/quiz/<quiz_id>/results', methods=['GET'])
@login_required
@admin_required
def admin_quiz_results(quiz_id):
    quiz = execute_query(
        """SELECT q.*, u.name as creator_name, u.role as creator_role
           FROM quizzes q
           JOIN users u ON q.created_by = u.user_id
           WHERE q.quiz_id = %s""",
        (quiz_id,), fetch_all=False
    )
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    results = execute_query(
        """SELECT qa.attempt_id, qa.user_id, u.name as student_name, u.email as student_email,
                  qa.score, qa.total_marks, qa.correct_answers, qa.wrong_answers,
                  qa.time_taken, qa.completed_at
           FROM quiz_attempts qa
           JOIN users u ON qa.user_id = u.user_id
           WHERE qa.quiz_id = %s
           ORDER BY qa.score DESC, qa.time_taken ASC""",
        (quiz_id,)
    )
    for idx, r in enumerate(results):
        r['rank'] = idx + 1

    return jsonify({
        "quiz": quiz,
        "results": results
    }), 200

# ----------------------------------------------------------------------
# ALL STUDENT ATTEMPTS (admin) - flat, filterable feed of every attempt
# across the entire platform, newest first.
# ----------------------------------------------------------------------
@admin_bp.route('/api/admin/all-attempts', methods=['GET'])
@login_required
@admin_required
def admin_all_attempts():
    category = request.args.get('category', '').strip()
    teacher_id = request.args.get('teacher_id', '').strip()

    query = """
        SELECT qa.attempt_id, qa.score, qa.total_marks, qa.correct_answers,
               qa.wrong_answers, qa.time_taken, qa.completed_at,
               s.name as student_name, s.email as student_email, s.user_id as student_id,
               q.quiz_id, q.title as quiz_title, q.category, q.difficulty,
               q.created_by as teacher_id, t.name as teacher_name
        FROM quiz_attempts qa
        JOIN users s ON qa.user_id = s.user_id
        JOIN quizzes q ON qa.quiz_id = q.quiz_id
        JOIN users t ON q.created_by = t.user_id
        WHERE 1=1
    """
    params = []
    if category:
        query += " AND q.category = %s"
        params.append(category)
    if teacher_id:
        query += " AND q.created_by = %s"
        params.append(teacher_id)

    query += " ORDER BY qa.completed_at DESC LIMIT 200"

    attempts = execute_query(query, tuple(params))
    return jsonify(attempts), 200

# ----------------------------------------------------------------------
# GLOBAL LEADERBOARD (admin) - same overall ranking visible to teachers,
# exposed here too so admin doesn't need to switch roles to check it.
# ----------------------------------------------------------------------
@admin_bp.route('/api/admin/leaderboard/overall', methods=['GET'])
@login_required
@admin_required
def admin_leaderboard_overall():
    query = """
        SELECT u.user_id, u.name, u.email, u.avatar,
               COUNT(qa.id) as total_attempts,
               COALESCE(SUM(qa.score), 0) as total_score,
               COALESCE(SUM(qa.total_marks), 0) as total_possible,
               COALESCE(AVG(qa.score / qa.total_marks * 100), 0) as avg_percent
        FROM users u
        JOIN quiz_attempts qa ON u.user_id = qa.user_id
        WHERE u.role = 'student'
        GROUP BY u.user_id, u.name, u.email, u.avatar
        HAVING total_attempts > 0
        ORDER BY avg_percent DESC, total_attempts DESC
        LIMIT 100
    """
    leaderboard = execute_query(query)
    for idx, row in enumerate(leaderboard):
        row['rank'] = idx + 1
    return jsonify(leaderboard), 200
