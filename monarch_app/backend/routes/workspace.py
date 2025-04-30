from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from routes.auth import get_current_user
from database.users import SessionLocal
from database.tables import Workspace, File
from typing import List, Dict, Any
from pydantic import BaseModel
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: str
    updated_at: str

@router.post("/api/workspaces")
async def create_workspace(
    workspace: WorkspaceCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Check if workspace name already exists for this user
        existing = db.query(Workspace).filter(
            Workspace.user_id == current_user.id,
            Workspace.name == workspace.name
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A workspace with this name already exists"
            )
        
        # Create new workspace
        new_workspace = Workspace(
            name=workspace.name,
            user_id=current_user.id
        )
        
        db.add(new_workspace)
        db.commit()
        db.refresh(new_workspace)
        
        return {
            "id": new_workspace.id,
            "name": new_workspace.name,
            "is_default": new_workspace.is_default,
            "created_at": new_workspace.created_at.isoformat() if new_workspace.created_at else None,
            "updated_at": new_workspace.updated_at.isoformat() if new_workspace.updated_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating workspace: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating workspace: {str(e)}"
        )

@router.get("/api/workspaces")
async def get_workspaces(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        workspaces = db.query(Workspace).filter(
            Workspace.user_id == current_user.id
        ).all()
        
        return [
            {
                "id": w.id,
                "name": w.name,
                "is_default": w.is_default,
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "updated_at": w.updated_at.isoformat() if w.updated_at else None
            }
            for w in workspaces
        ]
        
    except Exception as e:
        logger.error(f"Error fetching workspaces: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching workspaces: {str(e)}"
        )

@router.delete("/api/workspaces/{workspace_id}")
async def delete_workspace(
    workspace_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get workspace
        workspace = db.query(Workspace).filter(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id
        ).first()
        
        if not workspace:
            raise HTTPException(
                status_code=404,
                detail="Workspace not found"
            )
        
        # Don't allow deleting default workspace
        if workspace.is_default:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete default workspace"
            )
        
        # Delete workspace (this will cascade delete files)
        db.delete(workspace)
        db.commit()
        
        return {"message": "Workspace deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workspace: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting workspace: {str(e)}"
        )

@router.get("/api/workspaces/{workspace_id}/files")
async def get_workspace_files(
    workspace_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Verify workspace exists and belongs to user
        workspace = db.query(Workspace).filter(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id
        ).first()
        
        if not workspace:
            raise HTTPException(
                status_code=404,
                detail="Workspace not found"
            )
        
        # Get files in workspace
        files = db.query(File).filter(
            File.workspace_id == workspace_id
        ).all()
        
        return [
            {
                "id": f.id,
                "filename": f.filename,
                "file_type": f.file_type,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None
            }
            for f in files
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching workspace files: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching workspace files: {str(e)}"
        ) 