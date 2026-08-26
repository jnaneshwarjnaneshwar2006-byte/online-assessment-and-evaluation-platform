from flask import Blueprint, jsonify, session, request
from backend.database import execute_query
from backend.decorators import login_required, admin_required

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/api/student/analytics', methods=['GET'])
@login_required
def student_analytics():
    # If student, fetch their own. If admin/teacher, they can pass ?student_id=STUxxx
    current_role = session['user']['role']
    target_student_id = request.args.get('student_id')
    
    if target_student_id:
        if current_role not in ['admin', 'teacher']:
            return jsonify({"error": "Forbidden"}), 403
        student_id = target_student_id
    else:
        if current_role != 'student':
            return jsonify({"error": "Please specify student_id"}), 400
        student_id = session['user']['user_id']

    # 1. General summary stats
    summary = execute_query(
        """SELECT 
               COUNT(*) as total_attempts,
               COALESCE(AVG(score), 0) as avg_score,
               COALESCE(MAX(score), 0) as max_score,
               COALESCE(SUM(time_taken), 0) as total_time_spent
           FROM quiz_attempts 
           WHERE user_id = %s""",
        (student_id,), fetch_all=False
    )

    # 2. Category performance (Railway, SSC, Banking)
    category_perf = execute_query(
        """SELECT 
               q.category,
               COUNT(*) as attempts,
               AVG(qa.score) as avg_score,
               AVG(qa.total_marks) as avg_total_marks
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           WHERE qa.user_id = %s
           GROUP BY q.category""",
        (student_id,)
    )

    # 3. Difficulty performance (Easy, Medium, Hard)
    difficulty_perf = execute_query(
        """SELECT 
               q.difficulty,
               COUNT(*) as attempts,
               AVG(qa.score) as avg_score
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           WHERE qa.user_id = %s
           GROUP BY q.difficulty""",
        (student_id,)
    )

    # 4. Attempt history timeline (last 10 attempts)
    timeline = execute_query(
        """SELECT 
               qa.attempt_id,
               q.title,
               q.category,
               qa.score,
               qa.total_marks,
               qa.completed_at
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           WHERE qa.user_id = %s
           ORDER BY qa.completed_at ASC
           LIMIT 10""",
        (student_id,)
    )

    # 5. Weak topics / Wrong answer category breakdown
    # Check wrong answers vs category
    wrong_answers_breakdown = execute_query(
        """SELECT 
               q.category,
               COUNT(*) as total_wrong
           FROM quiz_answers qans
           JOIN quiz_questions qq ON qans.question_id = qq.id
           JOIN quizzes q ON qq.quiz_id = q.quiz_id
           JOIN quiz_attempts qa ON qans.attempt_id = qa.attempt_id
           WHERE qa.user_id = %s AND qans.is_correct = 0
           GROUP BY q.category""",
        (student_id,)
    )

    return jsonify({
        "summary": summary,
        "category_performance": category_perf,
        "difficulty_performance": difficulty_perf,
        "timeline": timeline,
        "wrong_answers_breakdown": wrong_answers_breakdown
    }), 200

@analytics_bp.route('/api/admin/analytics', methods=['GET'])
@login_required
@admin_required
def admin_analytics():
    # 1. Total users by role
    users_by_role = execute_query(
        "SELECT role, COUNT(*) as count FROM users GROUP BY role"
    )

    # 2. Blocked users
    blocked_count = execute_query(
        "SELECT COUNT(*) as count FROM users WHERE status = 'blocked'", fetch_all=False
    )

    # 3. Quiz count by category
    quizzes_by_category = execute_query(
        "SELECT category, COUNT(*) as count FROM quizzes GROUP BY category"
    )

    # 4. Total attempts and average score globally
    global_quiz_stats = execute_query(
        """SELECT 
               COUNT(*) as total_attempts,
               COALESCE(AVG(score), 0) as avg_score,
               COALESCE(AVG(time_taken), 0) as avg_time
           FROM quiz_attempts""",
        fetch_all=False
    )

    # 5. User registration timeline (past 7 days or total)
    user_timeline = execute_query(
        """SELECT DATE(created_at) as date, COUNT(*) as count 
           FROM users 
           GROUP BY DATE(created_at) 
           ORDER BY DATE(created_at) ASC 
           LIMIT 30"""
    )

    # 6. Popular quizzes (top 5 by attempts)
    popular_quizzes = execute_query(
        """SELECT q.title, q.category, COUNT(qa.id) as attempts 
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           GROUP BY q.quiz_id, q.title, q.category
           ORDER BY attempts DESC
           LIMIT 5"""
    )

    return jsonify({
        "users_by_role": users_by_role,
        "blocked_users_count": blocked_count['count'] if blocked_count else 0,
        "quizzes_by_category": quizzes_by_category,
        "global_quiz_stats": global_quiz_stats,
        "user_timeline": user_timeline,
        "popular_quizzes": popular_quizzes
    }), 200
