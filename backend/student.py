from flask import Blueprint, jsonify, session
from backend.database import execute_query
from backend.decorators import login_required, student_required

student_bp = Blueprint('student', __name__)

@student_bp.route('/api/student/history', methods=['GET'])
@login_required
@student_required
def student_history():
    user_id = session['user']['user_id']
    query = """
        SELECT qa.attempt_id, qa.score, qa.total_marks, qa.correct_answers, 
               qa.wrong_answers, qa.time_taken, qa.completed_at,
               q.quiz_id, q.title, q.category, q.difficulty, q.duration
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.quiz_id
        WHERE qa.user_id = %s
        ORDER BY qa.completed_at DESC
    """
    history = execute_query(query, (user_id,))
    return jsonify(history), 200
