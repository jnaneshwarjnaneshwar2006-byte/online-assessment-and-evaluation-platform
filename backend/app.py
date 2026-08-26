import os
import sys
from flask import Flask, render_template, redirect, url_for, session, request, jsonify, send_from_directory
from flask_cors import CORS

# Add root folder to sys.path to resolve imports cleanly
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
if root_dir not in sys.path:
    sys.path.append(root_dir)

from backend.config import Config
from backend.database import init_db, execute_query, execute_update
from backend.decorators import login_required, student_required, teacher_required, admin_required
from backend.notifications import get_user_notifications, mark_notification_as_read, mark_all_notifications_as_read

# Import blueprints
from backend.auth import auth_bp
from backend.quiz import quiz_bp
from backend.analytics import analytics_bp
from backend.feedback import feedback_bp
from backend.admin import admin_bp
from backend.teacher import teacher_bp
from backend.student import student_bp
from backend.ai_generator import create_and_save_ai_quiz

app = Flask(
    __name__,
    template_folder=os.path.join(root_dir, 'templates'),
    static_folder=os.path.join(root_dir, 'static')
)
app.config.from_object(Config)
CORS(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(quiz_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(feedback_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(teacher_bp)
app.register_blueprint(student_bp)

# Global context processor to make session available
@app.context_processor
def inject_user():
    return dict(user=session.get('user'))

# ----------------- WEBSITE PAGE ROUTING -----------------

@app.route('/')
def index_route():
    return render_template('index.html')

@app.route('/login')
def login_route():
    if 'user' in session:
        return redirect(url_for('dashboard_route'))
    return render_template('login.html')

@app.route('/teacher/login')
def teacher_login_route():
    if 'user' in session:
        return redirect(url_for('dashboard_route'))
    return render_template('teacher_login.html')

@app.route('/admin/login')
def admin_login_route():
    if 'user' in session:
        return redirect(url_for('dashboard_route'))
    return render_template('admin_login.html')

@app.route('/signup')
def signup_route():
    if 'user' in session:
        return redirect(url_for('dashboard_route'))
    return render_template('signup.html')

@app.route('/about')
def about_route():
    return render_template('about.html')

@app.route('/contact')
def contact_route():
    return render_template('contact.html')

@app.route('/faq')
def faq_route():
    return render_template('faq.html')

@app.route('/terms')
def terms_route():
    return render_template('terms.html')

@app.route('/profile')
@login_required
def profile_route():
    return render_template('profile.html')

@app.route('/results/<attempt_id>')
@login_required
def results_route(attempt_id):
    return render_template('results.html', attempt_id=attempt_id)

@app.route('/dashboard')
@login_required
def dashboard_route():
    role = session['user']['role']
    if role == 'admin':
        return redirect(url_for('admin_dashboard'))
    elif role == 'teacher':
        return redirect(url_for('teacher_dashboard'))
    else:
        return redirect(url_for('student_dashboard'))

# --- Student Views ---
@app.route('/student/dashboard')
@login_required
@student_required
def student_dashboard():
    return render_template('dashboard/student_dashboard.html')

@app.route('/student/quiz/list')
@login_required
@student_required
def student_quiz_list():
    return render_template('student/quiz_list.html')

@app.route('/student/quiz/attempt/<quiz_id>')
@login_required
@student_required
def student_quiz_attempt(quiz_id):
    return render_template('student/quiz_attempt.html', quiz_id=quiz_id)

@app.route('/student/quiz/history')
@login_required
@student_required
def student_quiz_history():
    return render_template('student/quiz_history.html')

@app.route('/student/analytics')
@login_required
@student_required
def student_analytics_view():
    return render_template('student/analytics.html')

@app.route('/student/feedback')
@login_required
@student_required
def student_feedback_view():
    return render_template('student/feedback.html')

@app.route('/student/recommendations')
@login_required
@student_required
def student_recommendations_view():
    return render_template('student/recommendations.html')

@app.route('/student/profile')
@login_required
@student_required
def student_profile_view():
    return render_template('student/profile.html')

@app.route('/student/results/<attempt_id>')
@login_required
@student_required
def student_results_view(attempt_id):
    return render_template('student/results.html', attempt_id=attempt_id)

# --- Teacher Views ---
@app.route('/teacher/dashboard')
@login_required
@teacher_required
def teacher_dashboard():
    return render_template('dashboard/teacher_dashboard.html')

@app.route('/teacher/students')
@login_required
@teacher_required
def teacher_students_view():
    return render_template('teacher/students_list.html')

@app.route('/teacher/student/<id>')
@login_required
@teacher_required
def teacher_student_profile(id):
    return render_template('teacher/student_profile.html', student_id=id)

@app.route('/teacher/feedback')
@login_required
@teacher_required
def teacher_feedback_view():
    return render_template('teacher/feedback.html')

@app.route('/teacher/analytics')
@login_required
@teacher_required
def teacher_analytics_view():
    return render_template('teacher/teacher_analytics.html')

@app.route('/teacher/quiz/create')
@login_required
@teacher_required
def teacher_quiz_create():
    return render_template('teacher/quiz_create.html')

@app.route('/teacher/quiz/ai-generator')
@login_required
@teacher_required
def teacher_ai_quiz_generator():
    return render_template('teacher/ai_quiz_generator.html')

@app.route('/teacher/results')
@login_required
@teacher_required
def teacher_results_overview():
    return render_template('teacher/results_overview.html')

@app.route('/teacher/results/<quiz_id>')
@login_required
@teacher_required
def teacher_quiz_results_view(quiz_id):
    return render_template('teacher/quiz_results_detail.html', quiz_id=quiz_id)

@app.route('/teacher/analysis/<quiz_id>')
@login_required
@teacher_required
def teacher_quiz_analysis_view(quiz_id):
    return render_template('teacher/quiz_analysis.html', quiz_id=quiz_id)

@app.route('/teacher/leaderboard')
@login_required
@teacher_required
def teacher_leaderboard_view():
    return render_template('teacher/leaderboard.html')

# --- Admin Views ---
@app.route('/admin/dashboard')
@login_required
@admin_required
def admin_dashboard():
    return render_template('dashboard/admin_dashboard.html')

@app.route('/admin/students')
@login_required
@admin_required
def admin_students_view():
    return render_template('admin/students.html')

@app.route('/admin/teachers')
@login_required
@admin_required
def admin_teachers_view():
    return render_template('admin/teachers.html')

@app.route('/admin/create-teacher')
@login_required
@admin_required
def admin_create_teacher():
    return render_template('admin/create_teacher.html')

@app.route('/admin/edit-teacher/<id>')
@login_required
@admin_required
def admin_edit_teacher(id):
    return render_template('admin/edit_teacher.html', teacher_id=id)

@app.route('/admin/blocked-users')
@login_required
@admin_required
def admin_blocked_users():
    return render_template('admin/blocked_users.html')

@app.route('/admin/activity-logs')
@login_required
@admin_required
def admin_activity_logs_view():
    return render_template('admin/activity_logs.html')

@app.route('/admin/quiz-statistics')
@login_required
@admin_required
def admin_quiz_statistics():
    return render_template('admin/quiz_statistics.html')

@app.route('/admin/website-analytics')
@login_required
@admin_required
def admin_website_analytics():
    return render_template('admin/website_analytics.html')

@app.route('/admin/results-overview')
@login_required
@admin_required
def admin_results_overview():
    return render_template('admin/results_overview.html')

@app.route('/admin/quiz-results/<quiz_id>')
@login_required
@admin_required
def admin_quiz_results_view(quiz_id):
    return render_template('admin/quiz_results_detail.html', quiz_id=quiz_id)

@app.route('/admin/leaderboard')
@login_required
@admin_required
def admin_leaderboard_view():
    return render_template('admin/leaderboard.html')

# --- Activity Log pages ---
@app.route('/activity-logs')
@login_required
def activity_logs_view():
    return render_template('activity_logs.html')

@app.route('/activity-teacher')
@login_required
@teacher_required
def activity_teacher_view():
    return render_template('activity_teacher.html')

# ----------------- UPLOADS ACCESS -----------------
@app.route('/uploads/avatars/<filename>')
def serve_avatar(filename):
    return send_from_directory(Config.AVATARS_FOLDER, filename)

# ----------------- NOTIFICATIONS API -----------------
@app.route('/api/notifications', methods=['GET'])
@login_required
def api_notifications():
    user_id = session['user']['user_id']
    notifs = get_user_notifications(user_id)
    return jsonify(notifs), 200

@app.route('/api/notifications/read/<int:notif_id>', methods=['POST'])
@login_required
def api_read_notification(notif_id):
    user_id = session['user']['user_id']
    mark_notification_as_read(notif_id, user_id)
    return jsonify({"message": "Notification marked as read"}), 200

@app.route('/api/notifications/read-all', methods=['POST'])
@login_required
def api_read_all_notifications():
    user_id = session['user']['user_id']
    mark_all_notifications_as_read(user_id)
    return jsonify({"message": "All notifications marked as read"}), 200

# ----------------- SPECIAL AI ENDPOINTS -----------------
@app.route('/api/ai-quiz/generate', methods=['POST'])
@login_required
def api_ai_quiz_generate():
    # Only teachers and students can trigger quiz generation
    user_id = session['user']['user_id']
    user_role = session['user']['role']
    
    data = request.get_json() or {}
    category = data.get('category', 'SSC') # 'Railway', 'SSC', 'Banking'
    difficulty = data.get('difficulty', 'Medium') # 'Easy', 'Medium', 'Hard'
    num_questions = int(data.get('num_questions', 5))
    
    if category not in ['Railway', 'SSC', 'Banking']:
        return jsonify({"error": "Invalid category. Choose Railway, SSC, or Banking."}), 400
    if difficulty not in ['Easy', 'Medium', 'Hard']:
        return jsonify({"error": "Invalid difficulty. Choose Easy, Medium, or Hard."}), 400
        
    quiz_id = create_and_save_ai_quiz(category, difficulty, num_questions, user_id)
    
    if not quiz_id:
        return jsonify({"error": "AI Quiz generation failed."}), 500
        
    # Write notification to the user
    execute_update(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (%s, %s, %s, %s)",
        (user_id, "AI Quiz Generated", f"Your customized {category} ({difficulty}) exam prep quiz is ready!", "info")
    )
        
    return jsonify({"message": "Quiz generated successfully", "quiz_id": quiz_id}), 201

@app.route('/api/ai-quiz/submit', methods=['POST'])
@login_required
def api_ai_quiz_submit():
    # Alias /api/quiz/attempt
    # Let's import and invoke the exact same handler logic or redirect internally.
    # It is cleaner to call the quiz attempt function.
    from backend.quiz import quiz_attempt
    return quiz_attempt()

@app.route('/api/ai/status', methods=['GET'])
@login_required
def api_ai_status():
    api_key = os.getenv("GEMINI_API_KEY", "")
    return jsonify({
        "status": "online" if api_key else "fallback_active",
        "model": "gemini-2.0-flash",
        "fallback_system": "Local Question Bank (Railway, SSC, Banking)",
        "features_enabled": ["Smart Quiz Generation", "Category-wise Weakness Detection", "Personalized Performance Analysis"]
    }), 200

# ----------------- SYSTEM ERROR ROUTING -----------------

@app.errorhandler(403)
def forbidden_error(error):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Forbidden"}), 403
    return render_template('errors/403.html'), 403

@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Not Found"}), 404
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Internal Server Error"}), 500
    return render_template('errors/500.html'), 500

# ----------------- INITIALIZE AND RUN -----------------
if __name__ == '__main__':
    print("Initializing database...")
    db_success = init_db()
    if not db_success:
        print("Warning: Database initialization failed. Ensure MySQL is running.")
    
    # Run the server
    print("Starting EduLearn Hub web application...")
    app.run(host='127.0.0.1', port=5000, debug=True)
