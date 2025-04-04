import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Initialize database for storing data tables
load_dotenv()
DATA_DATABASE_URL = os.getenv("DATA_DATABASE_URL")
engine = create_engine(DATA_DATABASE_URL, echo=True)

# Create session factory for data database
DataSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) 