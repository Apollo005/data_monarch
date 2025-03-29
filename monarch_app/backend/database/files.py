import os
from sqlalchemy import create_engine
from dotenv import load_dotenv

#initialize a database to store the current datatable in:
load_dotenv()
DATABASE_URL = os.getenv("DATA_DATABASE_URL")
engine = create_engine(DATABASE_URL, echo=True)