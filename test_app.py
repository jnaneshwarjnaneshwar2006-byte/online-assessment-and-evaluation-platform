import os
import sys

# Add root folder to sys.path to resolve imports cleanly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

def test_imports():
    print("Testing backend module imports...")
    try:
        from backend.config import Config
        from backend.database import init_db
        from backend.decorators import login_required
        from backend.auth import generate_random_captcha_text, generate_captcha_image
        from backend.gemini_service import generate_ai_quiz, FALLBACK_QUESTIONS
        from backend.ai_generator import create_and_save_ai_quiz
        
        print("[SUCCESS] All imports completed successfully.")
        
        # Test Captcha text generation
        txt = generate_random_captcha_text(5)
        assert len(txt) == 5, "Captcha text length check failed"
        print("[SUCCESS] Captcha text generation operates correctly.")

        # Test Local Quiz Fallback bank
        quiz = generate_ai_quiz("SSC", "Easy", 3)
        assert len(quiz['questions']) == 3, "Local fallback generator returned incorrect question count"
        print("[SUCCESS] Local fallback question bank functions correctly.")
        
    except Exception as e:
        print(f"[FAIL] Verification failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_imports()
