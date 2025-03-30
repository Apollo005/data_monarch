import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Get database URL
USER_DATABASE_URL = os.getenv("USER_DATABASE_URL")

# Create connection
user_engine = create_engine(USER_DATABASE_URL)

def cleanup():
    # Get list of tables to drop (excluding users and files tables)
    with user_engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name NOT IN ('users', 'files')
        """))
        tables = [row[0] for row in result]

    # Drop each table
    for table in tables:
        print(f"Dropping table {table}...")
        with user_engine.connect() as conn:
            conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
            conn.commit()
        print(f"Table {table} dropped successfully")

if __name__ == "__main__":
    cleanup() 