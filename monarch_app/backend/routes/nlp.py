from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from routes.auth import get_current_user
from database.users import SessionLocal
from database.tables import File
import pandas as pd
from sqlalchemy import create_engine, text, Table, Column, Integer, String, Float, MetaData, select
from database.files import engine
import os
from dotenv import load_dotenv
from typing import Dict, Any
import logging
from google import genai
from google.api_core import exceptions as google_exceptions
from pydantic import BaseModel
import json
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize the Gemini client with your API key
client = genai.Client(api_key=os.getenv("GENAI_API_KEY"))
logger.info("Gemini API key loaded successfully")

router = APIRouter()

class FilterRequest(BaseModel):
    file_id: int
    query: str

    class Config:
        orm_mode = True

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_next_table_name(db: Session, base_name: str) -> str:
    """Get the next available table name in the sequence file_edit_1, file_edit_2, etc."""
    i = 1
    while True:
        new_name = f"{base_name}_edit_{i}"
        # Check if table exists
        with engine.connect() as connection:
            result = connection.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '{new_name}'
                );
            """))
            exists = result.scalar()
        if not exists:
            return new_name
        i += 1

def create_new_table_from_query(db: Session, source_table: str, new_table: str, query: str) -> None:
    """Create a new table from the results of a query on the source table."""
    with engine.connect() as connection:
        # First, get the column names from the source table
        result = connection.execute(text(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{source_table}'
        """))
        columns = [row[0] for row in result]
        
        # Create new table with the same structure as source table
        connection.execute(text(f"""
            CREATE TABLE {new_table} AS 
            SELECT * FROM {source_table} WHERE 1=0;
        """))
        
        # Copy data based on the query
        connection.execute(text(f"""
            INSERT INTO {new_table}
            SELECT * FROM {source_table}
            WHERE {query};
        """))
        
        # Commit the transaction
        connection.commit()

def process_natural_language_query(query: str, df: pd.DataFrame) -> Dict[str, Any]:
    """
    Process natural language query using Gemini API to generate SQL operations
    """
    try:
        # Create a system message that explains the task
        system_message = """You are a data analysis assistant. Your task is to convert natural language queries into SQL WHERE clauses.
        The user will provide a query and you need to return a JSON object with:
        1. 'operation': The SQL operation type (e.g., 'filter', 'dropna')
        2. 'query': A valid SQL WHERE clause
        3. 'description': A human-readable description of what the operation does
        
        Example response for "remove rows with null values in column1 and column2":
        {
            "operation": "dropna",
            "query": "column1 IS NOT NULL AND column2 IS NOT NULL",
            "description": "Remove rows with null values in column1 and column2"
        }
        
        Example response for "filter rows where column1 is greater than 10":
        {
            "operation": "filter",
            "query": "column1 > 10",
            "description": "Filter rows where column1 is greater than 10"
        }
        
        Important: 
        1. Return only the JSON object, no other text or formatting.
        2. The column name will be explicit if in quotations so please keep them as so.
        3. Use the exact column names as provided in the available columns list.
        4. Column names are case-sensitive, so use them exactly as they appear.
        5. Do not include table names in the query - they will be added automatically.
        6. The WHERE clause should only contain column names and conditions.
        7. Make sure to use the exact column names from the provided list.
        8. Column names in PostgreSQL are case-sensitive, so use them exactly as they appear in the list.
        9. The column names must match exactly, including case.
        10. Do not include quotes around column names - they will be added automatically.
        11. The column names must be used exactly as they appear in the list, with the same case.
        """
        
        # Create a user message with the query and column information
        columns = list(df.columns)
        user_message = f"""Query: {query}
        Available columns: {columns}
        Please provide the SQL operation to perform. Use the exact column names as listed above."""
        
        logger.info(f"Sending query to Gemini: {query}")
        logger.info(f"Available columns: {columns}")
        
        # Use Gemini API to generate content
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"{system_message}\n{user_message}"
        )
        
        content = response.text
        logger.info(f"Gemini API response: {content}")
        
        # Strip out any non-JSON content
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            # Parse the response as JSON
            operation_dict = json.loads(content)
            
            if not isinstance(operation_dict, dict):
                raise ValueError("Response is not a dictionary")
            
            required_keys = ["operation", "query", "description"]
            for key in required_keys:
                if key not in operation_dict:
                    raise ValueError(f"Missing required key: {key}")
            
            return operation_dict
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response: {str(e)}")
            logger.error(f"Response content: {content}")
            raise HTTPException(
                status_code=500,
                detail=f"Invalid JSON response from Gemini: {str(e)}. Please try rephrasing your query."
            )
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {str(e)}")
            logger.error(f"Response content: {content}")
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response format from Gemini: {str(e)}. Please try rephrasing your query."
            )
        
    except google_exceptions.GoogleAPIError as e:
        logger.error(f"Gemini API error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing query: {str(e)}"
        )

@router.post("/api/data/filter")
async def filter_data(
    request: FilterRequest = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Received filter request for file_id: {request.file_id}, query: {request.query}")
        
        # Check ownership
        file_record = db.query(File).filter(
            File.id == request.file_id, 
            File.user_id == current_user.id
        ).first()
        if not file_record:
            logger.error(f"File not found for id: {request.file_id}")
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get the source table name
        source_table = file_record.file_path
        logger.info(f"Processing data from table: {source_table}")
        
        # Get the next available table name
        new_table = get_next_table_name(db, source_table)
        logger.info(f"Creating new table: {new_table}")
        
        # Get the actual column names from the current table
        with engine.connect() as connection:
            result = connection.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{source_table}'
            """))
            columns = [row[0] for row in result]
            logger.info(f"Found columns in table {source_table}: {columns}")
            
            # Create a dummy DataFrame with the actual column names
            df = pd.DataFrame(columns=columns)
            
            # Process the natural language query
            operation_dict = process_natural_language_query(request.query, df)
            
            # Validate that the column exists in the current table
            query_lower = operation_dict["query"].lower()
            column_found = False
            matching_column = None
            
            # First, try to find an exact match (case-sensitive)
            for column in columns:
                if column in operation_dict["query"]:
                    column_found = True
                    matching_column = column
                    break
            
            # If no exact match, try case-insensitive match
            if not column_found:
                for column in columns:
                    if column.lower() in query_lower:
                        column_found = True
                        matching_column = column
                        # Replace all occurrences of the column name (case-insensitive)
                        operation_dict["query"] = re.sub(
                            f'\\b{column}\\b',
                            f'"{column}"',
                            operation_dict["query"],
                            flags=re.IGNORECASE
                        )
                        break
            
            if not column_found:
                raise HTTPException(
                    status_code=400,
                    detail=f"Column not found in table. Available columns: {columns}"
                )
            
            logger.info(f"Using column '{matching_column}' for filtering")
            logger.info(f"Final query: {operation_dict['query']}")
            
            # Create new table with filtered data
            create_new_table_from_query(db, source_table, new_table, operation_dict["query"])
            
            # Update the file record with the new table name
            file_record.file_path = new_table
            db.commit()
            
            # Fetch the filtered data
            result = connection.execute(text(f"SELECT * FROM {new_table}"))
            # Convert the result to a list of dictionaries
            records = []
            for row in result:
                record = {}
                for i, col in enumerate(result.keys()):
                    record[col] = row[i]
                records.append(record)
        
        return {
            "data": records,
            "description": operation_dict["description"]
        }
        
    except Exception as e:
        logger.error(f"Error filtering data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error filtering data: {str(e)}") 