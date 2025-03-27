from imports import *
from tables import Base
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)