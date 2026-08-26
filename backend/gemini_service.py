import os
import json
import random
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Initialize Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Robust Fallback Question Bank
FALLBACK_QUESTIONS = {
    "Railway": {
        "Easy": [
            {
                "question_text": "Which is the longest railway platform in India?",
                "options": ["Gorakhpur", "Kollam Junction", "Hubballi Junction", "Kharagpur"],
                "correct_answer": "Hubballi Junction",
                "explanation": "Shree Siddharoodha Swamiji Hubballi Junction in Karnataka holds the record for the longest railway platform in the world, measuring 1,505 meters."
            },
            {
                "question_text": "In which year did the first passenger train run in India?",
                "options": ["1848", "1853", "1860", "1872"],
                "correct_answer": "1853",
                "explanation": "The first passenger train in India ran between Bori Bunder (Bombay) and Thane on April 16, 1853, covering a distance of 34 kilometers."
            },
            {
                "question_text": "Where is the headquarters of the Northern Railway zone located?",
                "options": ["New Delhi", "Mumbai", "Kolkata", "Gorakhpur"],
                "correct_answer": "New Delhi",
                "explanation": "The Northern Railway zone is headquartered in New Delhi, near Baroda House."
            }
        ],
        "Medium": [
            {
                "question_text": "Which railway station is at the highest altitude in India?",
                "options": ["Ghoom", "Ooty", "Shimla", "Darjeeling"],
                "correct_answer": "Ghoom",
                "explanation": "Ghoom railway station of the Darjeeling Himalayan Railway is the highest railway station in India, located at an altitude of 2,258 meters (7,407 ft)."
            },
            {
                "question_text": "Which technology is being deployed by Indian Railways to prevent train collisions?",
                "options": ["Kavach", "Suraksha", "Drishti", "Nayan"],
                "correct_answer": "Kavach",
                "explanation": "Kavach is an indigenously developed Automatic Train Protection (ATP) system designed to prevent collisions between trains."
            }
        ],
        "Hard": [
            {
                "question_text": "The Konkan Railway route passes through which of the following mountain ranges?",
                "options": ["Western Ghats", "Eastern Ghats", "Aravali", "Satpura"],
                "correct_answer": "Western Ghats",
                "explanation": "The Konkan Railway runs parallel to the Arabian Sea coast, cutting through the rugged terrain of the Western Ghats (Sahyadri ranges)."
            },
            {
                "question_text": "Which dedicated freight corridor (DFC) links Ludhiana in Punjab to Dankuni in West Bengal?",
                "options": ["Eastern DFC", "Western DFC", "Northern DFC", "Southern DFC"],
                "correct_answer": "Eastern DFC",
                "explanation": "The Eastern Dedicated Freight Corridor (EDFC) starts at Sahnewal (Ludhiana) in Punjab and terminates at Dankuni in West Bengal."
            }
        ]
    },
    "SSC": {
        "Easy": [
            {
                "question_text": "Who was the first female Prime Minister of India?",
                "options": ["Pratibha Patil", "Indira Gandhi", "Sarojini Naidu", "Sucheta Kripalani"],
                "correct_answer": "Indira Gandhi",
                "explanation": "Indira Gandhi served as the first and, to date, only female Prime Minister of India from 1966 to 1977 and again from 1980 until her assassination in 1984."
            },
            {
                "question_text": "Which planet is known as the Red Planet?",
                "options": ["Venus", "Mars", "Jupiter", "Saturn"],
                "correct_answer": "Mars",
                "explanation": "Mars is known as the Red Planet because iron minerals in its soil oxidize, or rust, causing the soil and atmosphere to look red."
            },
            {
                "question_text": "Which article of the Indian Constitution deals with the Right to Equality?",
                "options": ["Article 14", "Article 19", "Article 21", "Article 32"],
                "correct_answer": "Article 14",
                "explanation": "Article 14 of the Constitution of India provides for equality before the law or equal protection of the laws within the territory of India."
            }
        ],
        "Medium": [
            {
                "question_text": "Which chemical compound is commonly known as Washing Soda?",
                "options": ["Sodium Bicarbonate", "Sodium Carbonate", "Calcium Carbonate", "Sodium Chloride"],
                "correct_answer": "Sodium Carbonate",
                "explanation": "Washing soda is the chemical compound sodium carbonate (Na2CO3), while baking soda is sodium bicarbonate (NaHCO3)."
            },
            {
                "question_text": "Who established the slave dynasty (Mamluk Dynasty) in India?",
                "options": ["Iltutmish", "Qutb-ud-din Aibak", "Balban", "Razia Sultana"],
                "correct_answer": "Qutb-ud-din Aibak",
                "explanation": "Qutb-ud-din Aibak established the Mamluk (Slave) Dynasty in 1206, which was the first of five dynasties to rule the Delhi Sultanate."
            }
        ],
        "Hard": [
            {
                "question_text": "Which economist proposed the concept of 'Vicious Circle of Poverty'?",
                "options": ["Ragnar Nurkse", "Adam Smith", "Karl Marx", "Amartya Sen"],
                "correct_answer": "Ragnar Nurkse",
                "explanation": "Ragnar Nurkse formulated the thesis of the 'Vicious Circle of Poverty', which states that a country is poor because it is poor, due to low capital formation."
            },
            {
                "question_text": "Under whose viceroyalty was the Partition of Bengal carried out in 1905?",
                "options": ["Lord Curzon", "Lord Minto", "Lord Chelmsford", "Lord Irwin"],
                "correct_answer": "Lord Curzon",
                "explanation": "The Partition of Bengal was carried out in 1905 by the Viceroy of India, Lord Curzon, leading to widespread anti-partition movements."
            }
        ]
    },
    "Banking": {
        "Easy": [
            {
                "question_text": "Which organization regulates the monetary policy in India?",
                "options": ["SEBI", "IRDAI", "RBI", "NABARD"],
                "correct_answer": "RBI",
                "explanation": "The Reserve Bank of India (RBI) is India's central bank and regulatory body responsible for regulation of the Indian banking system and monetary policy."
            },
            {
                "question_text": "What is the full form of ATM in banking terms?",
                "options": ["Automated Teller Machine", "Any Time Money", "Active Transfer Machine", "Automatic Transaction Mode"],
                "correct_answer": "Automated Teller Machine",
                "explanation": "ATM stands for Automated Teller Machine, an electronic telecommunications device that enables customers to perform financial transactions."
            },
            {
                "question_text": "Which of the following is the largest public sector bank in India?",
                "options": ["Punjab National Bank", "Bank of Baroda", "State Bank of India", "HDFC Bank"],
                "correct_answer": "State Bank of India",
                "explanation": "State Bank of India (SBI) is a multinational, public sector banking and financial services statutory body and is the largest bank in India."
            }
        ],
        "Medium": [
            {
                "question_text": "What does 'R' stand for in RTGS?",
                "options": ["Real", "Rate", "Regular", "Rapid"],
                "correct_answer": "Real",
                "explanation": "RTGS stands for Real Time Gross Settlement. It refers to a continuous (real-time) settlement of funds transfers individually on an order by order basis."
            },
            {
                "question_text": "What is the rate at which RBI lends money to commercial banks in the event of any shortfall of funds?",
                "options": ["Reverse Repo Rate", "Repo Rate", "SLR", "CRR"],
                "correct_answer": "Repo Rate",
                "explanation": "Repo Rate (Repurchase Option Rate) is the key interest rate at which the Reserve Bank of India lends short-term money to commercial banks."
            }
        ],
        "Hard": [
            {
                "question_text": "Which committee recommended the establishment of Regional Rural Banks (RRBs) in India?",
                "options": ["Narasimham Committee", "Urjit Patel Committee", "Raghuram Rajan Committee", "Nachiket Mor Committee"],
                "correct_answer": "Narasimham Committee",
                "explanation": "The Narasimham Working Group (1975) first recommended the establishment of RRBs to provide credit services in rural areas."
            },
            {
                "question_text": "What is Basel III accord primarily focused on in the banking industry?",
                "options": ["Agricultural Credit Reforms", "Risk Management and Capital Adequacy", "Digital Banking Security", "Foreign Exchange Regulations"],
                "correct_answer": "Risk Management and Capital Adequacy",
                "explanation": "Basel III is an international regulatory accord that introduced a set of reforms designed to mitigate risk within the banking sector by requiring banks to maintain certain leverage ratios and keep capital reserves."
            }
        ]
    }
}

def generate_ai_quiz(category, difficulty, num_questions=5):
    """
    Generates a quiz using Google Gemini API.
    Falls back to a local question bank if API key is missing or call fails.
    """
    print(f"Generating AI quiz for {category} ({difficulty}), requesting {num_questions} questions...")
    
    if not GEMINI_API_KEY:
        print("Gemini API key is missing in environmental variables. Falling back to local bank.")
        return get_fallback_quiz(category, difficulty, num_questions)

    # Prepare Prompt
    prompt = f"""
    You are an expert examiner for Indian competitive exams (Railway, SSC, and Banking).
    Generate a quiz with exactly {num_questions} multiple-choice questions matching the following specs:
    - Category: {category} (exam style)
    - Difficulty: {difficulty}
    
    Return the response as a single, valid JSON object with the following structure:
    {{
        "title": "AI Generated {category} {difficulty} Quiz",
        "questions": [
            {{
                "question_text": "Question content...",
                "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
                "correct_answer": "Exact text of the correct option matching one of the options",
                "explanation": "Detailed explanation of why this answer is correct."
            }}
        ]
    }}
    
    Rules:
    1. The "correct_answer" MUST be a string matching one of the exact strings in the "options" array.
    2. Provide exactly 4 options.
    3. Ensure no trailing commas and strictly valid JSON.
    """

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        raw_text = response.text.strip()
        data = json.loads(raw_text)
        
        # Verify structure
        if "title" in data and "questions" in data and len(data["questions"]) > 0:
            # Check options and correct_answer compatibility
            for q in data["questions"]:
                if "options" not in q or len(q["options"]) != 4:
                    q["options"] = ["A", "B", "C", "D"] # Safest fallback
                if "correct_answer" not in q or q["correct_answer"] not in q["options"]:
                    q["correct_answer"] = q["options"][0]
                if "explanation" not in q:
                    q["explanation"] = "No explanation provided."
            return data
        else:
            print("Invalid structure in Gemini response. Using fallback.")
            return get_fallback_quiz(category, difficulty, num_questions)
            
    except Exception as e:
        print(f"Gemini API generation failed or returned invalid JSON: {e}")
        return get_fallback_quiz(category, difficulty, num_questions)

def get_fallback_quiz(category, difficulty, num_questions):
    """Fetches and builds a quiz from the local fallback question database."""
    # Find matching pool
    cat_pool = FALLBACK_QUESTIONS.get(category, FALLBACK_QUESTIONS["SSC"])
    diff_pool = cat_pool.get(difficulty, cat_pool["Medium"])
    
    # If pool has fewer questions than requested, we take all or cycle
    selected = random.sample(diff_pool, min(len(diff_pool), num_questions))
    
    # If we need more, we duplicate/augment
    while len(selected) < num_questions:
        selected.append(random.choice(diff_pool))
        
    return {
        "title": f"EduLearn Fallback {category} ({difficulty}) Quiz",
        "questions": selected
    }
