from functools import wraps
from flask import session, request, redirect, url_for, jsonify, render_template
from backend.database import execute_query

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            if request.path.startswith('/api/'):
                return jsonify({"error": "Unauthorized. Please log in."}), 401
            return redirect(url_for('login_route'))
        
        # Verify status is still active in DB
        user_id = session['user']['user_id']
        user = execute_query("SELECT status, role FROM users WHERE user_id = %s", (user_id,), fetch_all=False)
        if not user or user['status'] != 'active':
            session.clear()
            if request.path.startswith('/api/'):
                return jsonify({"error": "Your account has been blocked or does not exist."}), 403
            return redirect(url_for('login_route', error="Account is inactive or blocked."))
            
        return f(*args, **kwargs)
    return decorated_function

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user' not in session:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Unauthorized. Please log in."}), 401
                return redirect(url_for('login_route'))
                
            user_id = session['user']['user_id']
            user = execute_query("SELECT status, role FROM users WHERE user_id = %s", (user_id,), fetch_all=False)
            
            if not user:
                session.clear()
                if request.path.startswith('/api/'):
                    return jsonify({"error": "User not found."}), 404
                return redirect(url_for('login_route'))
                
            if user['status'] != 'active':
                session.clear()
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Account blocked."}), 403
                return redirect(url_for('login_route', error="Your account has been blocked."))
                
            if user['role'] not in roles:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Forbidden. Insufficient permissions."}), 403
                return render_template('errors/403.html'), 403
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def student_required(f):
    return role_required(['student'])(f)

def teacher_required(f):
    return role_required(['teacher'])(f)

def admin_required(f):
    return role_required(['admin'])(f)
