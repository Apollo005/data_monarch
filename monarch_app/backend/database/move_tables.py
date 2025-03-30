import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Get database URLs
USER_DATABASE_URL = os.getenv("USER_DATABASE_URL")
DATA_DATABASE_URL = os.getenv("DATA_DATABASE_URL")

# Create connections
user_engine = create_engine(USER_DATABASE_URL)
data_engine = create_engine(DATA_DATABASE_URL)

def move_tables():
    # Get list of tables to move (excluding users and files tables)
    with user_engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name NOT IN ('users', 'files')
        """))
        tables = [row[0] for row in result]

    for table in tables:
        print(f"Moving table {table}...")
        
        # Get table structure
        with user_engine.connect() as conn:
            result = conn.execute(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{table}'
                ORDER BY ordinal_position
            """))
            columns = [(row[0], row[1]) for row in result]

        # Create table in data_monarch
        with data_engine.connect() as conn:
            # Drop table if exists
            conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
            
            # Create table with same structure
            column_defs = [f'"{col}" {dtype}' for col, dtype in columns]
            create_table_sql = f"""
            CREATE TABLE {table} (
                {', '.join(column_defs)}
            )
            """
            conn.execute(text(create_table_sql))
            
            # Copy data
            conn.execute(text(f"INSERT INTO {table} SELECT * FROM {table}"))
            conn.commit()

        print(f"Table {table} moved successfully")

if __name__ == "__main__":
    move_tables() 