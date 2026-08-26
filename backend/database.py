import os
import mysql.connector
from mysql.connector import pooling
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

# Load env variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "root1234")
DB_NAME = os.getenv("DB_NAME", "edulearn_hub")

# Default admin credentials. Override these in .env (ADMIN_EMAIL / ADMIN_PASSWORD)
# for your deployment - these fallbacks are only used the very first time the
# database is initialized and the admin account doesn't exist yet.
DEFAULT_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin-29be40@edulearn.com")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ioov$lEwdmyHs&%@")

db_pool = None

def get_db_connection():
    global db_pool
    if db_pool is None:
        # Attempt to create database if not exists
        try:
            conn = mysql.connector.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD
            )
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Error checking/creating database: {e}")

        # Initialize Connection Pool
        try:
            db_pool = pooling.MySQLConnectionPool(
                pool_name="edulearn_pool",
                pool_size=5,
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME
            )
        except Exception as e:
            print(f"Error creating connection pool: {e}")
            # Try to return direct connection if pool fails
            return mysql.connector.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME
            )

    return db_pool.get_connection()

def execute_query(query, params=(), fetch_all=True):
    """Executes a SELECT query and returns the results."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, params)
        if fetch_all:
            result = cursor.fetchall()
        else:
            result = cursor.fetchone()
        return result
    except Exception as e:
        print(f"Database Query Error: {e}\nQuery: {query}\nParams: {params}")
        raise e
    finally:
        cursor.close()
        conn.close()

def execute_update(query, params=(), return_id=False):
    """Executes an INSERT, UPDATE, or DELETE query."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(query, params)
        conn.commit()
        last_id = cursor.lastrowid
        affected = cursor.rowcount
        return last_id if return_id else affected
    except Exception as e:
        conn.rollback()
        print(f"Database Update Error: {e}\nQuery: {query}\nParams: {params}")
        raise e
    finally:
        cursor.close()
        conn.close()

def init_db():
    """Initializes tables using schema.sql and populates the default admin."""
    # Find schema.sql path relative to this backend folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    schema_path = os.path.join(current_dir, '..', 'database', 'schema.sql')
    
    if not os.path.exists(schema_path):
        print(f"Schema file not found at {schema_path}")
        return False
        
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    # We need to execute schema queries. Since mysql connection doesn't execute multi-query well in one execute call
    # without setting multi=True, we use multi=True or split them.
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        results = cursor.execute(schema_sql, multi=True)
        if results:
            for r in results:
                pass
        conn.commit()
    except Exception as e:
        print(f"Error loading database schema: {e}")
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    # Add or update default admin based on environment variables
    try:
        admin = execute_query("SELECT * FROM users WHERE role = 'admin' AND user_id = 'ADMIN001'", fetch_all=False)
        if not admin:
            hashed_pw = generate_password_hash(DEFAULT_ADMIN_PASSWORD)
            execute_update(
                "INSERT INTO users (user_id, name, email, mobile, password, role, status) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                ("ADMIN001", "EduLearn Admin", DEFAULT_ADMIN_EMAIL, "9999999999", hashed_pw, "admin", "active")
            )
            # Create entry in admins table
            execute_update(
                "INSERT INTO admins (user_id, admin_id, permissions) VALUES (%s, %s, %s)",
                ("ADMIN001", "ADMIN001", "all")
            )
            print("Default admin created successfully.")
            print(f"   Admin email: {DEFAULT_ADMIN_EMAIL}")
            print("   Admin password: (see ADMIN_PASSWORD in your .env file)")
        else:
            from werkzeug.security import check_password_hash
            email_changed = admin['email'] != DEFAULT_ADMIN_EMAIL
            password_changed = not check_password_hash(admin['password'], DEFAULT_ADMIN_PASSWORD)
            
            if email_changed or password_changed:
                hashed_pw = generate_password_hash(DEFAULT_ADMIN_PASSWORD)
                execute_update(
                    "UPDATE users SET email = %s, password = %s WHERE user_id = 'ADMIN001'",
                    (DEFAULT_ADMIN_EMAIL, hashed_pw)
                )
                print("Admin credentials updated from environment variables.")
                print(f"   New admin email: {DEFAULT_ADMIN_EMAIL}")
                print("   New admin password: (updated from ADMIN_PASSWORD in your .env file)")
    except Exception as e:
        print(f"Error checking/updating default admin: {e}")
        return False
        
    return True