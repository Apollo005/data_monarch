# data.py (new route file or an existing place for data-related endpoints)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.tables import File
from routes.auth import get_current_user
from database.users import SessionLocal
import pandas as pd
from sqlalchemy import create_engine, text
from database.files import engine
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/api/data/{file_id}")
async def get_file_data(file_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        # Check ownership
        file_record = db.query(File).filter(
            File.id == file_id, 
            File.user_id == current_user.id
        ).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # The file_path might be the table name in your database
        table_name = file_record.file_path
        logger.info(f"Attempting to fetch data from table: {table_name}")
        
        # Use connection instead of engine directly
        with engine.connect() as connection:
            # First verify the table exists
            check_table = text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table_name}')")
            table_exists = connection.execute(check_table).scalar()
            
            if not table_exists:
                raise HTTPException(status_code=404, detail=f"Table {table_name} not found in database")
            
            # If table exists, fetch the data
            query = text(f"SELECT * FROM {table_name}")
            result = connection.execute(query)
            
            # Convert result to DataFrame
            df = pd.DataFrame(result.fetchall(), columns=result.keys())
            
            # Convert to list-of-dicts
            records = df.to_dict("records")
            logger.info(f"Successfully fetched {len(records)} records from table {table_name}")
            return {"data": records}
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in get_file_data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")
