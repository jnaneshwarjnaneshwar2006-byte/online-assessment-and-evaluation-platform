import random
import json
from backend.gemini_service import generate_ai_quiz
from backend.database import execute_update, execute_query

def create_and_save_ai_quiz(category, difficulty, num_questions, creator_id):
    """
    Triggers Gemini (or fallback) quiz generation and saves the result in the database.
    Returns the quiz_id on success, or None on failure.
    """
    # 1. Generate quiz data via AI service
    quiz_data = generate_ai_quiz(category, difficulty, num_questions)
    if not quiz_data or "questions" not in quiz_data or len(quiz_data["questions"]) == 0:
        return None

    # 2. Setup quiz details
    title = quiz_data.get("title", f"AI Generated {category} Quiz")
    
    # Calculate duration (in minutes) based on difficulty
    factor = 1.0
    if difficulty == "Medium":
        factor = 1.2
    elif difficulty == "Hard":
        factor = 1.5
    duration = int(len(quiz_data["questions"]) * factor)
    if duration < 1:
        duration = 5
        
    total_questions = len(quiz_data["questions"])
    marks_per_question = 10
    total_marks = total_questions * marks_per_question

    # Generate a unique quiz_id
    while True:
        candidate_id = f"AIQ{random.randint(100000, 999999)}"
        exists = execute_query("SELECT id FROM quizzes WHERE quiz_id = %s", (candidate_id,), fetch_all=False)
        if not exists:
            quiz_id = candidate_id
            break

    try:
        # 3. Save to quizzes table
        insert_quiz_query = """
            INSERT INTO quizzes (quiz_id, title, category, difficulty, duration, total_marks, total_questions, created_by, published) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
        """
        execute_update(insert_quiz_query, (
            quiz_id, title, category, difficulty, duration, total_marks, total_questions, creator_id
        ))

        # 4. Save questions to quiz_questions table
        for q in quiz_data["questions"]:
            insert_q_query = """
                INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, marks, explanation)
                VALUES (%s, %s, 'single-choice', %s, %s, %s, %s)
            """
            # Store options as JSON string
            options_json = json.dumps(q["options"])
            execute_update(insert_q_query, (
                quiz_id,
                q["question_text"],
                options_json,
                q["correct_answer"],
                marks_per_question,
                q.get("explanation", "")
            ))
            
        print(f"AI Quiz {quiz_id} created and saved successfully by {creator_id}")
        return quiz_id
        
    except Exception as e:
        print(f"Failed to save AI quiz: {e}")
        # Attempt cleanup if partial quiz saved
        try:
            execute_update("DELETE FROM quizzes WHERE quiz_id = %s", (quiz_id,))
        except Exception:
            pass
        return None
