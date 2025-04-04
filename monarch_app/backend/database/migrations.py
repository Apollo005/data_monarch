from sqlalchemy import create_engine, text
from database.files import engine as data_engine
from database.users import engine as user_engine
import logging

logger = logging.getLogger(__name__)

def run_user_migrations():
    """Run migrations for the user database."""
    try:
        with user_engine.connect() as connection:
            # Create users table first
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            logger.info("Users table migration completed")
            
            # Create files table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS files (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR NOT NULL,
                    file_path VARCHAR NOT NULL,
                    file_type VARCHAR(10),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, filename)
                );
            """))
            logger.info("Files table migration completed")
            
            # Create index on files
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_files_user_id 
                ON files(user_id);
            """))
            logger.info("Files index created")
            
            connection.commit()
            logger.info("User database migrations completed successfully")
            
    except Exception as e:
        logger.error(f"Error running user database migrations: {str(e)}")
        raise

def run_data_migrations():
    """Run migrations for the data database."""
    try:
        with data_engine.connect() as connection:
            # Create table_versions table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS table_versions (
                    id SERIAL PRIMARY KEY,
                    file_id INTEGER NOT NULL,
                    table_name VARCHAR NOT NULL,
                    version INTEGER NOT NULL,
                    is_current BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    description TEXT,
                    UNIQUE(file_id, version)
                );
            """))
            logger.info("Table versions table migration completed")
            
            # Create indexes for table_versions
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_table_versions_file_id 
                ON table_versions(file_id);
            """))
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_table_versions_current 
                ON table_versions(file_id, is_current);
            """))
            logger.info("Table versions indexes created")
            
            # Initialize versions for existing files if they don't have versions yet
            try:
                connection.execute(text("""
                    INSERT INTO table_versions (file_id, table_name, version, is_current, description)
                    SELECT id, file_path, 1, true, 'Initial version'
                    FROM files f
                    WHERE NOT EXISTS (
                        SELECT 1 FROM table_versions tv WHERE tv.file_id = f.id
                    );
                """))
                connection.commit()
                logger.info("Initialized versions for existing files")
            except Exception as e:
                logger.warning(f"Error initializing versions for existing files: {str(e)}")
                # Don't raise this error as it's not critical
            
            connection.commit()
            logger.info("Data database migrations completed successfully")
            
    except Exception as e:
        logger.error(f"Error running data database migrations: {str(e)}")
        raise

def run_migrations():
    """Run all database migrations."""
    run_user_migrations()
    run_data_migrations() 