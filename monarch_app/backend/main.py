from utils.imports import *
from models.filter import filter_data
from routes.auth import router as auth_router
from routes.upload import router as upload_router
from routes.files import router as files_router
from routes.data import router as data_router
from routes.nlp import router as nlp_router

app = FastAPI()

#enable CORS to allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Specific origin for React frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(files_router)
app.include_router(data_router)
app.include_router(nlp_router)

#testing the app
@app.get("/")
def read_root():
    return {"Hello": "World"}