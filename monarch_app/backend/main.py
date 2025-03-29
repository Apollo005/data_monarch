from utils.imports import *
from models.filter import filter_data
from routes.auth import router as auth_router
from routes.upload import router as upload_router
from database.tables import User

app = FastAPI()
app.include_router(auth_router)
app.include_router(upload_router)

#enable CORS to allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  #react frontend URL
    allow_credentials=True,
    allow_methods=["*"],  #allow all HTTP methods
    allow_headers=["*"],  #allow all headers
)

#testing the app

@app.get("/")
def read_root():
    return {"Hello": "World"}