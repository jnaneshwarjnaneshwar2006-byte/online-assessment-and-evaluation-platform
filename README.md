# EduLearn Hub - Online Assessment & Evaluation Platform

An AI-powered online quiz platform for competitive exam preparation (Railway, SSC, Banking) featuring role-based access for Students, Teachers, and Admins.

## Stack
- **Frontend**: HTML5, CSS3, JavaScript, Chart.js, Font Awesome
- **Backend**: Python Flask
- **Database**: MySQL
- **AI**: Google Gemini API (`gemini-2.0-flash` with local fallback bank)

## Quick Start
1. Ensure MySQL is running on localhost (port 3306).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the Flask application:
   ```bash
   python backend/app.py
   ```
4. Access the web interface at `http://127.0.0.1:5000`.

## Login Portals
There are three separate login pages:
- **Student**: `/login`
- **Teacher**: `/teacher/login` (also has a Sign Up tab — see below)
- **Admin**: `/admin/login`

## Admin Credentials (Secret)
The admin account email/password are no longer the public defaults. They now
live in your `.env` file as `ADMIN_EMAIL` and `ADMIN_PASSWORD`:

- **Admin Email**: `ADMIN_EMAIL` (set your own in `.env`)
- **Admin Password**: `ADMIN_PASSWORD` (set your own in `.env`)

> Treat these the same as any other production secret — don't commit `.env`
> to a public repo, and change them to your own values whenever you like by
> editing `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.
> 
> When the application starts up, it automatically synchronizes the admin
> credentials in the database with the values currently set in your `.env` file.
> If you ever change the email or password in `.env`, the database record will be
> updated on the next startup.

- **Demo OTP** (student login only): `123456`

> Only the admin account above can sign in through `/admin/login`. There is
> no public sign-up path for the `admin` role — the `/api/signup` endpoint
> only allows `student` or `teacher` roles. The `admin_required` decorator
> further locks every `/admin/*` page and API route to users whose `role` is
> `admin` in the database.

## Teacher Signup
New teachers can create their own account directly from `/teacher/login` →
**Sign Up** tab. They provide name, email, mobile, department, qualification,
experience, and a password — no admin approval step is required, the account
is active immediately (mirrors how student signup already works). Admins can
still onboard teachers manually too, via **Admin → Onboard Teacher**, if you
prefer to create accounts yourself instead.

## Teacher Dashboard Features
- **My Students** — roster with attempt counts and average scores
- **Quiz Results** (`/teacher/results`) — every quiz you created, with class
  average / highest / lowest scores
- **Quiz Results Detail** (`/teacher/results/<quiz_id>`) — every student's
  attempt for one quiz, ranked, with pass/fail status
- **Quiz Analysis** (`/teacher/analysis/<quiz_id>`) — class score distribution
  chart, correct-vs-wrong breakdown, and question-by-question difficulty
  (which questions students struggled with most)
- **Leaderboard** (`/teacher/leaderboard`) — platform-wide student ranking,
  both an overall average-score leaderboard and a per-quiz leaderboard
  (selectable by quiz)

## Admin Dashboard Features
- **Manage Students / Manage Teachers** — full visibility into every account
- **Quiz Results Overview** (`/admin/results-overview`) — every quiz created
  by every teacher, filterable by category or by teacher
- **Quiz Results Detail** (`/admin/quiz-results/<quiz_id>`) — every student
  attempt for any quiz on the platform, regardless of who created it
- **Leaderboard** (`/admin/leaderboard`) — same platform-wide student ranking
  available to teachers, surfaced here too so admin doesn't need to act as a
  teacher to check it
- Existing: Onboard Teacher, Blocked Accounts, System Logs, Quiz Statistics,
  Web Analytics

