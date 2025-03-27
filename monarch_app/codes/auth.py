from codes.imports import *
from codes.tables import User
from codes.database import SessionLocal

#change this later to be not an in mem db
load_dotenv()
DATABASE_URL = os.getenv("USER_DATABASE_URL")
engine = create_engine(DATABASE_URL, echo=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    username: str
    password: str

#new user register
@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = pwd_context.hash(user.password)
    new_user = User(username=user.username, password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

#login an existing user
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == form_data.username).first()
    if not db_user or not pwd_context.verify(form_data.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    #simulate a session token (replace with JWT or real session later)
    token = str(uuid.uuid4())
    return {"access_token": token, "token_type": "bearer"}