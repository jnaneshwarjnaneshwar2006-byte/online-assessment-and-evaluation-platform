import json
from flask import Blueprint, jsonify, session, request
from backend.database import execute_query, execute_update
from backend.decorators import login_required, teacher_required

teacher_bp = Blueprint('teacher', __name__)

@teacher_bp.route('/api/teacher/students', methods=['GET'])
@login_required
@teacher_required
def teacher_students():
    # List all students, with their total attempts and average score
    query = """
        SELECT u.user_id, u.name, u.email, u.mobile, u.status, u.created_at,
               COUNT(qa.id) as total_attempts,
               COALESCE(AVG(qa.score), 0) as avg_score
        FROM users u
        LEFT JOIN quiz_attempts qa ON u.user_id = qa.user_id
        WHERE u.role = 'student'
        GROUP BY u.user_id, u.name, u.email, u.mobile, u.status, u.created_at
        ORDER BY u.name ASC
    """
    students = execute_query(query)
    return jsonify(students), 200

@teacher_bp.route('/api/teacher/student/<id>', methods=['GET'])
@login_required
@teacher_required
def teacher_student_detail(id):
    # Get student profile
    student = execute_query(
        "SELECT user_id, name, email, mobile, status, avatar, created_at FROM users WHERE user_id = %s AND role = 'student'",
        (id,), fetch_all=False
    )
    if not student:
        return jsonify({"error": "Student not found"}), 404

    # Get student attempts
    attempts = execute_query(
        """SELECT qa.attempt_id, qa.score, qa.total_marks, qa.completed_at, qa.time_taken, q.title, q.category, q.difficulty 
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           WHERE qa.user_id = %s
           ORDER BY qa.completed_at DESC""",
        (id,)
    )

    # Get feedback given to this student
    feedbacks = execute_query(
        """SELECT tf.*, u.name as teacher_name 
           FROM teacher_feedback tf
           JOIN users u ON tf.teacher_id = u.user_id
           WHERE tf.student_id = %s
           ORDER BY tf.created_at DESC""",
        (id,)
    )

    return jsonify({
        "student": student,
        "attempts": attempts,
        "feedbacks": feedbacks
    }), 200

@teacher_bp.route('/api/teacher/activity-stats', methods=['GET'])
@login_required
@teacher_required
def teacher_activity_stats():
    teacher_id = session['user']['user_id']
    
    # 1. Total quizzes created by this teacher
    quizzes_created = execute_query(
        "SELECT COUNT(*) as count FROM quizzes WHERE created_by = %s",
        (teacher_id,), fetch_all=False
    )
    
    # 2. Total feedback submitted by this teacher
    feedback_submitted = execute_query(
        "SELECT COUNT(*) as count FROM teacher_feedback WHERE teacher_id = %s",
        (teacher_id,), fetch_all=False
    )

    # 3. Average score of students attempting this teacher's quizzes
    avg_score_on_quizzes = execute_query(
        """SELECT COALESCE(AVG(qa.score), 0) as avg_score
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           WHERE q.created_by = %s""",
        (teacher_id,), fetch_all=False
    )

    return jsonify({
        "quizzes_created": quizzes_created['count'] if quizzes_created else 0,
        "feedback_submitted": feedback_submitted['count'] if feedback_submitted else 0,
        "avg_score_on_quizzes": avg_score_on_quizzes['avg_score'] if avg_score_on_quizzes else 0
    }), 200

@teacher_bp.route('/api/teacher/activities', methods=['GET'])
@login_required
@teacher_required
def teacher_activities():
    teacher_id = session['user']['user_id']
    # List teacher actions
    query = """
        SELECT action, details, ip_address, created_at 
        FROM activity_logs 
        WHERE user_id = %s 
        ORDER BY created_at DESC 
        LIMIT 50
    """
    logs = execute_query(query, (teacher_id,))
    return jsonify(logs), 200

# ----------------------------------------------------------------------
# QUIZ RESULTS - List of quizzes (created by this teacher) with summary
# ----------------------------------------------------------------------
@teacher_bp.route('/api/teacher/quizzes-summary', methods=['GET'])
@login_required
@teacher_required
def teacher_quizzes_summary():
    teacher_id = session['user']['user_id']

    query = """
        SELECT q.quiz_id, q.title, q.category, q.difficulty, q.total_marks,
               q.total_questions, q.duration, q.created_at,
               COUNT(qa.id) as total_attempts,
               COALESCE(AVG(qa.score), 0) as avg_score,
               COALESCE(MAX(qa.score), 0) as highest_score,
               COALESCE(MIN(qa.score), 0) as lowest_score
        FROM quizzes q
        LEFT JOIN quiz_attempts qa ON q.quiz_id = qa.quiz_id
        WHERE q.created_by = %s
        GROUP BY q.quiz_id, q.title, q.category, q.difficulty, q.total_marks,
                 q.total_questions, q.duration, q.created_at
        ORDER BY q.created_at DESC
    """
    quizzes = execute_query(query, (teacher_id,))
    return jsonify(quizzes), 200

# ----------------------------------------------------------------------
# QUIZ RESULTS - Detailed list of every student attempt for one quiz
# ----------------------------------------------------------------------
@teacher_bp.route('/api/teacher/quiz/<quiz_id>/results', methods=['GET'])
@login_required
@teacher_required
def teacher_quiz_results(quiz_id):
    teacher_id = session['user']['user_id']

    quiz = execute_query(
        "SELECT * FROM quizzes WHERE quiz_id = %s",
        (quiz_id,), fetch_all=False
    )
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    # Teachers may only inspect their own quizzes (admins bypass via a different endpoint)
    if quiz['created_by'] != teacher_id:
        return jsonify({"error": "Forbidden. You did not create this quiz."}), 403

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

    # Attach rank number (1-indexed) based on the score/time ordering above
    for idx, r in enumerate(results):
        r['rank'] = idx + 1

    return jsonify({
        "quiz": quiz,
        "results": results
    }), 200

# ----------------------------------------------------------------------
# QUIZ ANALYSIS - Class performance + question-wise difficulty breakdown
# ----------------------------------------------------------------------
@teacher_bp.route('/api/teacher/quiz/<quiz_id>/analysis', methods=['GET'])
@login_required
@teacher_required
def teacher_quiz_analysis(quiz_id):
    teacher_id = session['user']['user_id']

    quiz = execute_query(
        "SELECT * FROM quizzes WHERE quiz_id = %s",
        (quiz_id,), fetch_all=False
    )
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    if quiz['created_by'] != teacher_id:
        return jsonify({"error": "Forbidden. You did not create this quiz."}), 403

    # 1. Overall class stats
    summary = execute_query(
        """SELECT COUNT(*) as total_attempts,
                  COALESCE(AVG(score), 0) as avg_score,
                  COALESCE(MAX(score), 0) as highest_score,
                  COALESCE(MIN(score), 0) as lowest_score,
                  COALESCE(AVG(time_taken), 0) as avg_time_taken,
                  COALESCE(AVG(correct_answers), 0) as avg_correct,
                  COALESCE(AVG(wrong_answers), 0) as avg_wrong
           FROM quiz_attempts
           WHERE quiz_id = %s""",
        (quiz_id,), fetch_all=False
    )

    # 2. Score distribution buckets (for a histogram): 0-20%,21-40%,41-60%,61-80%,81-100%
    total_marks = quiz['total_marks'] or 1
    attempts = execute_query(
        "SELECT score FROM quiz_attempts WHERE quiz_id = %s",
        (quiz_id,)
    )
    buckets = {"0-20%": 0, "21-40%": 0, "41-60%": 0, "61-80%": 0, "81-100%": 0}
    for a in attempts:
        pct = (a['score'] / total_marks) * 100 if total_marks else 0
        if pct <= 20:
            buckets["0-20%"] += 1
        elif pct <= 40:
            buckets["21-40%"] += 1
        elif pct <= 60:
            buckets["41-60%"] += 1
        elif pct <= 80:
            buckets["61-80%"] += 1
        else:
            buckets["81-100%"] += 1

    # 3. Question-wise difficulty: how many students got each question right/wrong
    question_breakdown = execute_query(
        """SELECT qq.id as question_id, qq.question_text, qq.marks,
                  COALESCE(SUM(qans.is_correct), 0) as correct_count,
                  COUNT(qans.id) as total_answered
           FROM quiz_questions qq
           LEFT JOIN quiz_answers qans ON qq.id = qans.question_id
           LEFT JOIN quiz_attempts qa ON qans.attempt_id = qa.attempt_id AND qa.quiz_id = qq.quiz_id
           WHERE qq.quiz_id = %s
           GROUP BY qq.id, qq.question_text, qq.marks
           ORDER BY qq.id ASC""",
        (quiz_id,)
    )

    for q in question_breakdown:
        total = q['total_answered'] or 0
        correct = q['correct_count'] or 0
        q['accuracy_percent'] = round((correct / total) * 100, 1) if total > 0 else 0
        q['wrong_count'] = total - correct

    return jsonify({
        "quiz": quiz,
        "summary": summary,
        "score_distribution": buckets,
        "question_breakdown": question_breakdown
    }), 200

# ----------------------------------------------------------------------
# LEADERBOARD - Overall (platform-wide, all students, all quizzes)
# ----------------------------------------------------------------------
@teacher_bp.route('/api/teacher/leaderboard/overall', methods=['GET'])
@login_required
@teacher_required
def teacher_leaderboard_overall():
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

# ----------------------------------------------------------------------
# LEADERBOARD - Per quiz (platform-wide, ranked by that quiz's score)
# ----------------------------------------------------------------------
@teacher_bp.route('/api/teacher/leaderboard/quiz/<quiz_id>', methods=['GET'])
@login_required
@teacher_required
def teacher_leaderboard_per_quiz(quiz_id):
    quiz = execute_query("SELECT * FROM quizzes WHERE quiz_id = %s", (quiz_id,), fetch_all=False)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    query = """
        SELECT u.user_id, u.name, u.email, u.avatar,
               qa.attempt_id, qa.score, qa.total_marks, qa.time_taken, qa.completed_at
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.user_id
        WHERE qa.quiz_id = %s
        ORDER BY qa.score DESC, qa.time_taken ASC
        LIMIT 100
    """
    leaderboard = execute_query(query, (quiz_id,))
    for idx, row in enumerate(leaderboard):
        row['rank'] = idx + 1

    return jsonify({
        "quiz": quiz,
        "leaderboard": leaderboard
    }), 200

# ----------------------------------------------------------------------
# Simple list of quizzes for dropdown selectors (id + title only)
# ----------------------------------------------------------------------
@teacher_bp.route('/api/teacher/quizzes-lite', methods=['GET'])
@login_required
@teacher_required
def teacher_quizzes_lite():
    quizzes = execute_query(
        "SELECT quiz_id, title, category FROM quizzes ORDER BY created_at DESC"
    )
    return jsonify(quizzes), 200
