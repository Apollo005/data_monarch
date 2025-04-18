from utils.imports import *
from models.filter import filter_data
from routes.auth import router as auth_router
from routes.upload import router as upload_router
from routes.files import router as files_router
from routes.data import router as data_router
from routes.nlp import router as nlp_router
from routes.analysis import router as analysis_router
from database.migrations import run_migrations
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS with more specific settings
origins = [
    "http://localhost:3000",  # React development server
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Credentials",
        "X-Requested-With"
    ],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Run database migrations
@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Starting database migrations...")
        run_migrations()
        logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Fatal error running migrations: {str(e)}")
        logger.error("Application startup failed due to migration errors")
        sys.exit(1)  # Exit the application if migrations fail

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(files_router)
app.include_router(data_router)
app.include_router(nlp_router)
app.include_router(analysis_router)

#testing the app
@app.get("/")
def read_root():
    return {"Hello": "World"}