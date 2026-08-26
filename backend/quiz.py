import random
import json
from flask import Blueprint, request, jsonify, session
from backend.database import execute_query, execute_update
from backend.decorators import login_required

quiz_bp = Blueprint('quiz', __name__)

@quiz_bp.route('/api/quiz/list', methods=['GET'])
@login_required
def quiz_list():
    category = request.args.get('category', '').strip()
    difficulty = request.args.get('difficulty', '').strip()
    
    query = "SELECT * FROM quizzes WHERE published = 1"
    params = []
    
    if category:
        query += " AND category = %s"
        params.append(category)
    if difficulty:
        query += " AND difficulty = %s"
        params.append(difficulty)
        
    query += " ORDER BY created_at DESC"
    
    quizzes = execute_query(query, tuple(params))
    return jsonify(quizzes), 200

@quiz_bp.route('/api/quiz/<quiz_id>', methods=['GET'])
@login_required
def quiz_detail(quiz_id):
    quiz = execute_query("SELECT * FROM quizzes WHERE quiz_id = %s", (quiz_id,), fetch_all=False)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404
        
    # Fetch questions
    questions = execute_query(
        "SELECT id, question_text, question_type, options, marks FROM quiz_questions WHERE quiz_id = %s", 
        (quiz_id,)
    )
    
    for q in questions:
        # Options are JSON serialized
        try:
            q['options'] = json.loads(q['options'])
        except Exception:
            pass # Keep as string if parsing fails
            
    return jsonify({
        "quiz": quiz,
        "questions": questions
    }), 200

@quiz_bp.route('/api/quiz/attempt', methods=['POST'])
@login_required
def quiz_attempt():
    user_id = session['user']['user_id']
    data = request.get_json() or {}
    quiz_id = data.get('quiz_id')
    user_answers = data.get('answers', {}) # Dict of {question_id: user_answer_text}
    time_taken = int(data.get('time_taken', 0)) # in seconds

    if not quiz_id:
        return jsonify({"error": "Quiz ID is required"}), 400

    quiz = execute_query("SELECT * FROM quizzes WHERE quiz_id = %s", (quiz_id,), fetch_all=False)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    # Fetch correct questions
    questions = execute_query(
        "SELECT id, correct_answer, marks, explanation FROM quiz_questions WHERE quiz_id = %s", 
        (quiz_id,)
    )

    correct_answers_count = 0
    wrong_answers_count = 0
    score = 0
    total_marks = quiz['total_marks']
    
    answers_to_insert = []

    for q in questions:
        q_id = str(q['id'])
        correct_ans = q['correct_answer'].strip()
        user_ans = user_answers.get(q_id, '').strip()
        
        is_correct = 0
        marks_obtained = 0
        
        if user_ans and user_ans.lower() == correct_ans.lower():
            is_correct = 1
            marks_obtained = q['marks']
            correct_answers_count += 1
            score += marks_obtained
        else:
            wrong_answers_count += 1
            
        answers_to_insert.append({
            "question_id": q['id'],
            "user_answer": user_ans,
            "is_correct": is_correct,
            "marks_obtained": marks_obtained
        })

    # Generate unique attempt_id
    while True:
        candidate_id = f"ATT{random.randint(100000, 999999)}"
        exists = execute_query("SELECT id FROM quiz_attempts WHERE attempt_id = %s", (candidate_id,), fetch_all=False)
        if not exists:
            attempt_id = candidate_id
            break

    try:
        # Save to quiz_attempts
        execute_update(
            """INSERT INTO quiz_attempts 
               (attempt_id, user_id, quiz_id, score, total_marks, correct_answers, wrong_answers, time_taken) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (attempt_id, user_id, quiz_id, score, total_marks, correct_answers_count, wrong_answers_count, time_taken)
        )

        # Save individual answers
        for ans in answers_to_insert:
            execute_update(
                """INSERT INTO quiz_answers 
                   (attempt_id, question_id, user_answer, is_correct, marks_obtained) 
                   VALUES (%s, %s, %s, %s, %s)""",
                (attempt_id, ans['question_id'], ans['user_answer'], ans['is_correct'], ans['marks_obtained'])
            )

        # Log activity
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (user_id, "Quiz Attempted", f"Attempted quiz {quiz_id} (Score: {score}/{total_marks})", request.remote_addr)
        )

        return jsonify({
            "message": "Quiz submitted successfully",
            "attempt_id": attempt_id,
            "score": score,
            "total_marks": total_marks,
            "correct_answers": correct_answers_count,
            "wrong_answers": wrong_answers_count
        }), 201

    except Exception as e:
        return jsonify({"error": f"Submission failed: {str(e)}"}), 500

@quiz_bp.route('/api/quiz/results/<attempt_id>', methods=['GET'])
@login_required
def quiz_results(attempt_id):
    # Fetch attempt details
    attempt = execute_query(
        """SELECT qa.*, q.title, q.category, q.difficulty 
           FROM quiz_attempts qa 
           JOIN quizzes q ON qa.quiz_id = q.quiz_id 
           WHERE qa.attempt_id = %s""",
        (attempt_id,), fetch_all=False
    )
    if not attempt:
        return jsonify({"error": "Result attempt not found"}), 404
        
    # Security: check if current user is owner or admin/teacher
    user_id = session['user']['user_id']
    user_role = session['user']['role']
    if attempt['user_id'] != user_id and user_role not in ['admin', 'teacher']:
        return jsonify({"error": "Forbidden. You cannot view other students' results."}), 403

    # Fetch answers detail
    answers = execute_query(
        """SELECT qa.id as answer_id, qa.user_answer, qa.is_correct, qa.marks_obtained, 
                  qq.id as question_id, qq.question_text, qq.options, qq.correct_answer, qq.explanation
           FROM quiz_answers qa
           JOIN quiz_questions qq ON qa.question_id = qq.id
           WHERE qa.attempt_id = %s""",
        (attempt_id,)
    )

    for ans in answers:
        try:
            ans['options'] = json.loads(ans['options'])
        except Exception:
            pass

    return jsonify({
        "attempt": attempt,
        "answers": answers
    }), 200

@quiz_bp.route('/api/quiz/create', methods=['POST'])
@login_required
def quiz_create():
    user_id = session['user']['user_id']
    user_role = session['user']['role']
    if user_role not in ['teacher', 'admin']:
        return jsonify({"error": "Forbidden"}), 403
        
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    category = data.get('category', '').strip()
    difficulty = data.get('difficulty', '').strip()
    duration = int(data.get('duration', 10))
    questions = data.get('questions', [])
    
    if not title or not category or not difficulty or not questions:
        return jsonify({"error": "Missing required fields"}), 400
        
    total_questions = len(questions)
    total_marks = sum(int(q.get('marks', 10)) for q in questions)
    
    # Generate unique quiz_id
    while True:
        candidate_id = f"MAN{random.randint(100000, 999999)}"
        exists = execute_query("SELECT id FROM quizzes WHERE quiz_id = %s", (candidate_id,), fetch_all=False)
        if not exists:
            quiz_id = candidate_id
            break
            
    try:
        execute_update(
            """INSERT INTO quizzes (quiz_id, title, category, difficulty, duration, total_marks, total_questions, created_by, published) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)""",
            (quiz_id, title, category, difficulty, duration, total_marks, total_questions, user_id)
        )
        
        for q in questions:
            options_json = json.dumps(q.get('options', []))
            execute_update(
                """INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, marks, explanation)
                   VALUES (%s, %s, 'single-choice', %s, %s, %s, %s)""",
                (quiz_id, q.get('question_text'), options_json, q.get('correct_answer'), int(q.get('marks', 10)), q.get('explanation', ''))
            )
            
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (user_id, "Create Quiz", f"Manually created quiz: {title} ({quiz_id})", request.remote_addr)
        )
        return jsonify({"message": "Quiz created successfully", "quiz_id": quiz_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

