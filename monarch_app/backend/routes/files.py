from utils.imports import *
from database.tables import User, File
from routes.auth import get_current_user
from database.users import SessionLocal
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os
from database.files import engine
import re
from utils.sanitize import sanitize_table_name_sql

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
    user_id: int

    class Config:
        from_attributes = True
        populate_by_name = True
        orm_mode = True

@router.get("/api/files", response_model=List[FileResponse])
async def get_user_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all files associated with the current user"""
    files = db.query(File).filter(File.user_id == current_user.id).order_by(File.created_at.asc()).all()
    return files

@router.get("/api/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific file by ID (if owned by the current user)"""
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
    # Get the file from the user's files
    file = db.query(File).filter(
        File.id == file_id,
        File.user_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Sanitize the table name
        table_name = sanitize_table_name_sql(file.filename)
        
        # Delete the file from the data_monarch database
        with engine.connect() as conn:
            try:
                # Drop the table if it exists
                conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
                conn.commit()
            except Exception as e:
                print(f"Error dropping table {table_name}: {str(e)}")
                # Continue with file deletion even if table drop fails
        
        # Delete the file from the user's files
        db.delete(file)
        db.commit()
        
        return {"message": "File deleted successfully"}
    except Exception as e:
        db.rollback()
        print(f"Error deleting file: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error deleting file: {str(e)}"
        ) 