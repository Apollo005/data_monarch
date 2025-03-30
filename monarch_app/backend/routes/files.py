from utils.imports import *
from database.tables import User, File
from routes.auth import get_current_user
from database.users import SessionLocal
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class FileResponse(BaseModel):
    id: int
    filename: str
    file_path: str
    file_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/api/files/", response_model=List[FileResponse])
async def get_user_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    "Get all files associated with the current user"
    files = db.query(File).filter(File.user_id == current_user.id).all()
    return files

@router.get("/api/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    "Get a specific file by ID (if owned by the current user)"
    file = db.query(File).filter(
        File.id == file_id,
        File.user_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file

@router.delete("/api/files/{file_id}")
async def delete_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific file (if owned by the current user)"""
    file = db.query(File).filter(
        File.id == file_id,
        File.user_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    db.delete(file)
    db.commit()
    return {"message": "File deleted successfully"} 