import os
import json
import google.generativeai as genai
from flask import Blueprint, jsonify, session, request
from backend.database import execute_query, execute_update
from backend.decorators import login_required, teacher_required
from backend.notifications import create_notification

feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route('/api/student/feedback', methods=['GET'])
@login_required
def student_feedback():
    user_id = session['user']['user_id']
    user_role = session['user']['role']
    
    # If student, retrieve feedback sent to them.
    # If teacher or admin, retrieve all feedback they have given or filter by ?student_id=STUxxx
    if user_role == 'student':
        query = """
            SELECT tf.*, u.name as teacher_name, u.email as teacher_email 
            FROM teacher_feedback tf
            JOIN users u ON tf.teacher_id = u.user_id
            WHERE tf.student_id = %s
            ORDER BY tf.created_at DESC
        """
        feedback = execute_query(query, (user_id,))
    else:
        student_id = request.args.get('student_id')
        if student_id:
            query = """
                SELECT tf.*, u.name as teacher_name 
                FROM teacher_feedback tf
                JOIN users u ON tf.teacher_id = u.user_id
                WHERE tf.student_id = %s
                ORDER tf.created_at DESC
            """
            feedback = execute_query(query, (student_id,))
        else:
            query = """
                SELECT tf.*, u.name as teacher_name, s.name as student_name 
                FROM teacher_feedback tf
                JOIN users u ON tf.teacher_id = u.user_id
                JOIN users s ON tf.student_id = s.user_id
                ORDER BY tf.created_at DESC
            """
            feedback = execute_query(query)
            
    return jsonify(feedback), 200

@feedback_bp.route('/api/student/feedback/read/<feedback_id>', methods=['POST'])
@login_required
def read_feedback(feedback_id):
    user_id = session['user']['user_id']
    execute_update(
        "UPDATE teacher_feedback SET is_read = 1 WHERE id = %s AND student_id = %s",
        (feedback_id, user_id)
    )
    return jsonify({"message": "Feedback marked as read"}), 200

@feedback_bp.route('/api/teacher/add-feedback', methods=['POST'])
@login_required
@teacher_required
def add_feedback():
    teacher_id = session['user']['user_id']
    data = request.get_json() or {}
    
    student_id = data.get('student_id')
    feedback_type = data.get('feedback_type', 'Performance') # 'Performance', 'Behavior', 'Guidance'
    title = data.get('title', '').strip()
    message = data.get('message', '').strip()
    topic = data.get('topic', '').strip()

    if not student_id or not title or not message:
        return jsonify({"error": "student_id, title, and message are required"}), 400

    # Verify student exists
    student = execute_query("SELECT name FROM users WHERE user_id = %s AND role = 'student'", (student_id,), fetch_all=False)
    if not student:
        return jsonify({"error": "Student does not exist"}), 404

    try:
        execute_update(
            """INSERT INTO teacher_feedback (teacher_id, student_id, feedback_type, title, message, topic, is_read) 
               VALUES (%s, %s, %s, %s, %s, %s, 0)""",
            (teacher_id, student_id, feedback_type, title, message, topic)
        )

        # Notify student
        create_notification(
            student_id,
            f"New Teacher Feedback: {title}",
            f"Teacher {session['user']['name']} added feedback regarding {feedback_type} on topic '{topic}'.",
            "feedback"
        )

        return jsonify({"message": "Feedback submitted successfully"}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to submit feedback: {str(e)}"}), 500

@feedback_bp.route('/api/student/recommendations', methods=['GET'])
@feedback_bp.route('/api/ai/recommendations', methods=['GET'])
@login_required
def student_recommendations():
    # If student, retrieve their own recommendations. If teacher/admin, get for a specific student.
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

    # Retrieve student's attempt stats to feed into recommendation
    attempts = execute_query(
        """SELECT q.category, qa.score, qa.total_marks, q.title
           FROM quiz_attempts qa
           JOIN quizzes q ON qa.quiz_id = q.quiz_id
           WHERE qa.user_id = %s
           ORDER BY qa.completed_at DESC
           LIMIT 10""",
        (student_id,)
    )

    if not attempts:
        return jsonify({
            "status": "success",
            "source": "local_analyzer",
            "recommendations": [
                "You haven't attempted any quizzes yet. Please take a quiz in Railway, SSC, or Banking category to get personalized AI recommendations."
            ]
        }), 200

    # Calculate category performance
    cat_scores = {}
    for att in attempts:
        cat = att['category']
        percent = (att['score'] / att['total_marks']) * 100 if att['total_marks'] > 0 else 0
        if cat not in cat_scores:
            cat_scores[cat] = []
        cat_scores[cat].append(percent)

    # Average performance per category
    avg_cat_scores = {cat: sum(scores)/len(scores) for cat, scores in cat_scores.items()}

    # Try Gemini if API key exists
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    if GEMINI_API_KEY:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.0-flash')
            
            prompt = f"""
            Analyze the following exam preparation history for a student:
            Category Averages: {json.dumps(avg_cat_scores)}
            Recent Attempts: {json.dumps(attempts[:5])}
            
            Based on this performance data, provide exactly 3 actionable, motivational recommendations for their competitive exam preparation (Railway, SSC, Banking).
            Return the output as a valid JSON array of strings. Do not include markdown wraps or backticks outside the JSON.
            """
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            recs = json.loads(response.text.strip())
            if isinstance(recs, list) and len(recs) > 0:
                return jsonify({
                    "status": "success",
                    "source": "gemini_api",
                    "recommendations": recs
                }), 200
        except Exception as e:
            print(f"Gemini recommendations failed: {e}. Falling back to local analyzer.")

    # Rule-based fallback local analyzer
    recs = []
    # Find lowest performing category
    lowest_cat = None
    lowest_score = 100
    for cat, score in avg_cat_scores.items():
        if score < lowest_score:
            lowest_score = score
            lowest_cat = cat

    if lowest_cat:
        recs.append(f"Your performance in '{lowest_cat}' is currently lowest (average {lowest_score:.1f}%). Focus on strengthening your core concepts in this section.")
    
    # Check general performance levels
    overall_avg = sum(avg_cat_scores.values()) / len(avg_cat_scores) if avg_cat_scores else 0
    if overall_avg < 60:
        recs.append("Your average score is below 60%. Try practicing with 'Easy' difficulty quizzes first to build confidence before attempting 'Medium' and 'Hard' exams.")
    else:
        recs.append("Great job! Your average score is above 60%. Challenge yourself by attempting more 'Hard' difficulty quizzes in Railway or Banking.")

    # Suggest category specific recommendations
    if "Banking" in avg_cat_scores and avg_cat_scores["Banking"] < 70:
        recs.append("For Banking preparation: Focus on economic terms, Basel accords, and Reserve Bank of India (RBI) policies. Practice speed math for quantitative sections.")
    if "SSC" in avg_cat_scores and avg_cat_scores["SSC"] < 70:
        recs.append("For SSC preparation: Strengthen your Indian history (Article 14-32) and general science topics, as they have high weightage.")
    if "Railway" in avg_cat_scores and avg_cat_scores["Railway"] < 70:
        recs.append("For Railway preparation: Study Indian Railway zones, recent safety systems like 'Kavach', and general static awareness.")

    # Ensure we return at least 3 recommendations
    while len(recs) < 3:
        recs.append("Maintain a consistent study schedule, review explanations of wrong answers, and re-attempt weak topics.")

    return jsonify({
        "status": "success",
        "source": "local_analyzer",
        "recommendations": recs[:3]
    }), 200
