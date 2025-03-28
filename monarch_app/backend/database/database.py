from utils.imports import *
#will need to keep taking off and on "codes" path
load_dotenv()
DATABASE_URL = os.getenv("USER_DATABASE_URL")
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)