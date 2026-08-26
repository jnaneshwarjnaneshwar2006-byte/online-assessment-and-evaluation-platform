import os
import random
import string
import io
from flask import Blueprint, request, jsonify, session, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image, ImageDraw, ImageFont
from backend.database import execute_query, execute_update
from backend.decorators import login_required

auth_bp = Blueprint('auth', __name__)

def generate_random_captcha_text(length=5):
    """Generates a random string of alphanumeric characters."""
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def generate_captcha_image(text):
    """Generates a CAPTCHA image and returns it as a bytes object."""
    # Image size
    width, height = 150, 50
    # Create image with a modern sleek dark/glassy background
    image = Image.new('RGB', (width, height), color=(30, 41, 59))
    draw = ImageDraw.Draw(image)
    
    # Try to load a font, otherwise use default
    try:
        # standard Windows font
        font = ImageFont.truetype("arial.ttf", 26)
    except IOError:
        font = ImageFont.load_default()

    # Draw text with random colors and slight offsets
    for i, char in enumerate(text):
        char_x = 15 + i * 25 + random.randint(-4, 4)
        char_y = 10 + random.randint(-4, 4)
        # Use elegant palette colors
        color = (
            random.randint(100, 255),
            random.randint(100, 255),
            random.randint(150, 255)
        )
        draw.text((char_x, char_y), char, font=font, fill=color)

    # Draw random noise lines to make it robust
    for _ in range(5):
        x1 = random.randint(0, width)
        y1 = random.randint(0, height)
        x2 = random.randint(0, width)
        y2 = random.randint(0, height)
        line_color = (random.randint(50, 150), random.randint(50, 150), random.randint(100, 200))
        draw.line((x1, y1, x2, y2), fill=line_color, width=2)

    # Draw random noise points
    for _ in range(100):
        xy = (random.randint(0, width), random.randint(0, height))
        draw.point(xy, fill=(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200)))

    # Save to memory stream
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

@auth_bp.route('/api/captcha', methods=['GET'])
def get_captcha():
    captcha_text = generate_random_captcha_text()
    session['captcha'] = captcha_text.lower()
    img_bytes = generate_captcha_image(captcha_text)
    return send_file(img_bytes, mimetype='image/png')

@auth_bp.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    mobile = data.get('mobile', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'student') # Default to student

    if not name or not email or not mobile or not password:
        return jsonify({"error": "All fields are required"}), 400

    if role not in ['student', 'teacher']:
        return jsonify({"error": "Role must be student or teacher. Admin accounts are not self-registrable."}), 400

    # Teachers additionally provide department / qualification / experience,
    # mirroring the fields admin fills in when onboarding a teacher manually.
    department = data.get('department', '').strip()
    qualification = data.get('qualification', '').strip()
    experience = data.get('experience', '').strip()

    if role == 'teacher' and (not department or not qualification or not experience):
        return jsonify({"error": "Department, qualification, and experience are required for teacher accounts"}), 400

    # Check if user already exists
    existing_user = execute_query("SELECT id FROM users WHERE email = %s", (email,), fetch_all=False)
    if existing_user:
        return jsonify({"error": "Email is already registered"}), 409

    # Generate a unique user_id - STU for students, TCH for teachers
    id_prefix = "TCH" if role == "teacher" else "STU"
    while True:
        candidate_id = f"{id_prefix}{random.randint(100000, 999999)}"
        exists = execute_query("SELECT id FROM users WHERE user_id = %s", (candidate_id,), fetch_all=False)
        if not exists:
            user_id = candidate_id
            break

    hashed_pw = generate_password_hash(password)
    try:
        execute_update(
            "INSERT INTO users (user_id, name, email, mobile, password, role, status) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (user_id, name, email, mobile, hashed_pw, role, 'active')
        )

        if role == "teacher":
            # created_by is left NULL here (vs. set to an admin_id when admin
            # onboards a teacher manually) so self-registered teacher accounts
            # remain distinguishable from admin-created ones if ever needed.
            execute_update(
                "INSERT INTO teachers (user_id, teacher_id, department, qualification, experience) VALUES (%s, %s, %s, %s, %s)",
                (user_id, user_id, department, qualification, experience)
            )

        # Log activity
        action_label = "Teacher Signup" if role == "teacher" else "Signup"
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (user_id, action_label, f"Registered new {role} account: {email}", request.remote_addr)
        )
        
        return jsonify({"message": "Registration successful!", "user_id": user_id}), 201
    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    captcha_input = data.get('captcha', '').strip().lower()
    expected_role = data.get('role', '').strip().lower()

    if not email or not password or not captcha_input:
        return jsonify({"error": "Email, password, and CAPTCHA are required"}), 400

    # Verify CAPTCHA
    stored_captcha = session.get('captcha')
    if not stored_captcha or captcha_input != stored_captcha:
        return jsonify({"error": "Invalid CAPTCHA"}), 400

    # Fetch user
    user = execute_query("SELECT * FROM users WHERE email = %s", (email,), fetch_all=False)
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if user['status'] != 'active':
        return jsonify({"error": "Your account is blocked. Please contact the administrator."}), 403

    # Check password
    if not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    # If the person picked a specific login tab (student/teacher/admin), make sure
    # the account they're signing into actually has that role.
    if expected_role and expected_role in ('student', 'teacher', 'admin') and user['role'] != expected_role:
        return jsonify({"error": f"This account is not a{'n' if expected_role == 'admin' else ''} {expected_role} account."}), 403

    # Login successful - setup session
    session['user'] = {
        'user_id': user['user_id'],
        'name': user['name'],
        'email': user['email'],
        'role': user['role'],
        'avatar': user['avatar']
    }
    # Clear captcha
    session.pop('captcha', None)

    # Log activity
    execute_update(
        "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
        (user['user_id'], "Login", "Standard email login", request.remote_addr)
    )

    return jsonify({
        "message": "Login successful",
        "user": {
            "user_id": user['user_id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "avatar": user['avatar']
        }
    }), 200

@auth_bp.route('/api/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = execute_query("SELECT * FROM users WHERE email = %s", (email,), fetch_all=False)
    if not user:
        return jsonify({"error": "No user found with this email"}), 404

    if user['status'] != 'active':
        return jsonify({"error": "Your account is blocked."}), 403

    # Demo OTP setup
    otp = "123456"
    session['otp_verification'] = {
        "email": email,
        "otp": otp
    }
    
    print(f"[OTP DEMO] Generated OTP {otp} for email {email}")
    return jsonify({"message": "OTP sent successfully to your registered email (Demo OTP: 123456)"}), 200

@auth_bp.route('/api/login-otp', methods=['POST'])
def login_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    otp_input = data.get('otp', '').strip()
    expected_role = data.get('role', '').strip().lower()

    if not email or not otp_input:
        return jsonify({"error": "Email and OTP are required"}), 400

    otp_info = session.get('otp_verification')
    if not otp_info or otp_info['email'] != email:
        return jsonify({"error": "Please request OTP first"}), 400

    # Demo OTP allows 123456 or the generated OTP
    if otp_input != otp_info['otp'] and otp_input != "123456":
        return jsonify({"error": "Invalid OTP"}), 400

    # Load User
    user = execute_query("SELECT * FROM users WHERE email = %s", (email,), fetch_all=False)
    if not user:
        return jsonify({"error": "User record not found"}), 404

    if user['status'] != 'active':
        return jsonify({"error": "Your account is blocked."}), 403

    # If the person picked a specific login tab (student/teacher/admin), make sure
    # the account they're signing into actually has that role.
    if expected_role and expected_role in ('student', 'teacher', 'admin') and user['role'] != expected_role:
        return jsonify({"error": f"This account is not a{'n' if expected_role == 'admin' else ''} {expected_role} account."}), 403

    # Login successful
    session['user'] = {
        'user_id': user['user_id'],
        'name': user['name'],
        'email': user['email'],
        'role': user['role'],
        'avatar': user['avatar']
    }
    session.pop('otp_verification', None)

    execute_update(
        "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
        (user['user_id'], "Login (OTP)", "OTP-based login", request.remote_addr)
    )

    return jsonify({
        "message": "Login successful",
        "user": {
            "user_id": user['user_id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "avatar": user['avatar']
        }
    }), 200

@auth_bp.route('/api/user/profile', methods=['GET', 'PUT'])
@login_required
def user_profile():
    user_id = session['user']['user_id']
    if request.method == 'GET':
        user = execute_query("SELECT user_id, name, email, mobile, role, avatar, created_at FROM users WHERE user_id = %s", (user_id,), fetch_all=False)
        return jsonify(user), 200

    elif request.method == 'PUT':
        # Update profile details
        # Check if form data or JSON
        if request.is_json:
            data = request.get_json() or {}
            name = data.get('name', '').strip()
            mobile = data.get('mobile', '').strip()
        else:
            name = request.form.get('name', '').strip()
            mobile = request.form.get('mobile', '').strip()

        if not name or not mobile:
            return jsonify({"error": "Name and mobile are required"}), 400

        # Handle file upload if any
        avatar_filename = session['user']['avatar']
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and file.filename:
                # generate filename
                ext = os.path.splitext(file.filename)[1].lower()
                if ext in ['.png', '.jpg', '.jpeg', '.gif']:
                    avatar_filename = f"{user_id}_avatar{ext}"
                    # Uploads directory is backend/../uploads/avatars
                    current_dir = os.path.dirname(os.path.abspath(__file__))
                    upload_path = os.path.join(current_dir, '..', 'uploads', 'avatars', avatar_filename)
                    os.makedirs(os.path.dirname(upload_path), exist_ok=True)
                    file.save(upload_path)
                else:
                    return jsonify({"error": "Unsupported file format"}), 400

        execute_update(
            "UPDATE users SET name = %s, mobile = %s, avatar = %s WHERE user_id = %s",
            (name, mobile, avatar_filename, user_id)
        )
        
        # Update session
        session['user']['name'] = name
        session['user']['avatar'] = avatar_filename
        session.modified = True

        return jsonify({"message": "Profile updated successfully", "name": name, "avatar": avatar_filename}), 200

@auth_bp.route('/api/user/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json() or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not old_password or not new_password:
        return jsonify({"error": "Old and new password are required"}), 400

    user_id = session['user']['user_id']
    user = execute_query("SELECT password FROM users WHERE user_id = %s", (user_id,), fetch_all=False)
    
    if not check_password_hash(user['password'], old_password):
        return jsonify({"error": "Incorrect old password"}), 400

    hashed_pw = generate_password_hash(new_password)
    execute_update("UPDATE users SET password = %s WHERE user_id = %s", (hashed_pw, user_id))
    
    # Log activity
    execute_update(
        "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
        (user_id, "Change Password", "User changed their password", request.remote_addr)
    )

    return jsonify({"message": "Password changed successfully"}), 200

@auth_bp.route('/api/logout', methods=['POST', 'GET'])
def logout():
    if 'user' in session:
        user_id = session['user']['user_id']
        execute_update(
            "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (%s, %s, %s, %s)",
            (user_id, "Logout", "User logged out", request.remote_addr)
        )
    session.clear()
    if request.path.startswith('/api/'):
        return jsonify({"message": "Logged out successfully"}), 200
    return redirect(url_for('login_route'))
