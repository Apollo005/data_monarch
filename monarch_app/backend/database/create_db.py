from utils.imports import *
from database.tables import Base
from database.user_database import DATABASE_URL

engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)