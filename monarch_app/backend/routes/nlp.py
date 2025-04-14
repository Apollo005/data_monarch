from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from routes.auth import get_current_user
from database.users import SessionLocal as UserSessionLocal
from database.files import DataSessionLocal, engine as data_engine
from database.tables import File, TableVersion
from sqlalchemy import create_engine, text, Table, Column, Integer, String, Float, MetaData, select, inspect, desc
from database.files import engine
import os
from dotenv import load_dotenv
from typing import Dict, Any, List, Tuple
import logging
from google import genai
from google.api_core import exceptions as google_exceptions
from pydantic import BaseModel
import json
import re
from enum import Enum
import pandas as pd

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
        from_attributes = True

class UndoRedoResponse(BaseModel):
    success: bool
    message: str
    current_version: int
    total_versions: int
    data: List[Dict[str, Any]]

    class Config:
        from_attributes = True

class Operator(Enum):
    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_EQUAL = ">="
    LESS_EQUAL = "<="
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    LIKE = "LIKE"
    NOT_LIKE = "NOT LIKE"
    IN = "IN"
    NOT_IN = "NOT IN"

# List of forbidden SQL keywords and patterns
FORBIDDEN_KEYWORDS = [
    "DROP", "TRUNCATE", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "GRANT",
    "REVOKE", "EXECUTE", "EXEC", "UNION", "JOIN", "HAVING", "GROUP BY", "ORDER BY",
    "LIMIT", "OFFSET", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END"
]

# List of forbidden comment patterns
FORBIDDEN_COMMENTS = ["--", "#", "/*", "*/"]

def get_user_db():
    db = UserSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_data_db():
    db = DataSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_next_table_name(db: Session, base_name: str) -> str:
    """Get the next available table name in the sequence file_edit_1, file_edit_2, etc."""
    # Extract the base name without any existing edit suffixes
    base_name = base_name.split('_edit_')[0]
    
    # Find the highest existing version number
    with data_engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name LIKE :pattern
                ORDER BY table_name DESC
                LIMIT 1
            """),
            {"pattern": f"{base_name}_edit_%"}
        )
        last_table = result.scalar()
        
        if last_table:
            # Extract the version number from the last table name
            try:
                last_version = int(last_table.split('_edit_')[-1])
                new_version = last_version + 1
            except ValueError:
                new_version = 1
        else:
            new_version = 1
            
        new_name = f"{base_name}_edit_{new_version}"
        
        # Verify the new name doesn't exist (just to be safe)
        result = connection.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :table_name)"),
            {"table_name": new_name}
        )
        exists = result.scalar()
        
        if exists:
            # If by some chance the table exists, try the next number
            new_version += 1
            new_name = f"{base_name}_edit_{new_version}"
            
        return new_name

def create_new_table_from_query(db: Session, source_table: str, new_table: str, query: str, params: Dict[str, Any]) -> None:
    """Create a new table from the results of a query on the source table."""
    with data_engine.connect() as connection:
        try:
            # Start a transaction
            trans = connection.begin()
            
            # First, get the column names from the source table using parameterized query
            result = connection.execute(
                text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = :table_name
                """),
                {"table_name": source_table}
            )
            columns = [row[0] for row in result]
            logger.info(f"Found columns in table {source_table}: {columns}")
            
            # Create new table with the same structure as source table
            connection.execute(
                text(f"CREATE TABLE {new_table} AS SELECT * FROM {source_table} WHERE 1=0")
            )
            
            # Do NOT modify the query here - it's already been sanitized
            modified_query = query
            
            # First, verify the query works by trying to select from the source table
            test_query = f"SELECT * FROM {source_table} WHERE {modified_query} LIMIT 1"
            logger.info(f"Testing query: {test_query}")
            
            try:
                test_result = connection.execute(text(test_query), params)
                test_result.fetchone()  # This will raise an error if the query is invalid
            except Exception as e:
                logger.error(f"Test query failed: {str(e)}")
                logger.error(f"Test query: {test_query}")
                logger.error(f"Parameters: {params}")
                raise ValueError(f"Invalid query: {str(e)}")
            
            # If the test query works, proceed with the insert
            try:
                # Create the insert query
                insert_query = f"""
                    INSERT INTO {new_table} 
                    SELECT * FROM {source_table} 
                    WHERE {modified_query}
                """
                logger.info(f"Executing insert query: {insert_query}")
                connection.execute(text(insert_query), params)
            except Exception as e:
                logger.error(f"Insert query failed: {str(e)}")
                logger.error(f"Insert query: {insert_query}")
                logger.error(f"Parameters: {params}")
                raise ValueError(f"Failed to insert data: {str(e)}")
            
            # Commit the transaction
            trans.commit()
            logger.info(f"Successfully created and populated table {new_table}")
            
        except Exception as e:
            # Rollback the transaction on error
            if 'trans' in locals():
                trans.rollback()
            logger.error(f"Error in create_new_table_from_query: {str(e)}")
            logger.error(f"Original query: {query}")
            logger.error(f"Modified query: {modified_query}")
            logger.error(f"Params: {params}")
            logger.error(f"Source table: {source_table}")
            logger.error(f"New table: {new_table}")
            logger.error(f"Full error details: {str(e.__class__.__name__)}: {str(e)}")
            if hasattr(e, 'orig'):
                logger.error(f"Original error: {str(e.orig)}")
            raise e

def validate_table_name(table_name: str) -> bool:
    """Validate that the table name is safe to use."""
    # Only allow alphanumeric characters, underscores, and dots
    return bool(re.match(r'^[a-zA-Z0-9_\.]+$', table_name))

def validate_column_name(column_name: str) -> bool:
    """Validate that the column name is safe to use."""
    # Only allow alphanumeric characters, underscores, and spaces
    return bool(re.match(r'^[a-zA-Z0-9_\s]+$', column_name))

def contains_forbidden_keywords(query: str) -> bool:
    """Check if the query contains any forbidden SQL keywords or patterns."""
    query_upper = query.upper()
    return any(keyword in query_upper for keyword in FORBIDDEN_KEYWORDS)

def contains_forbidden_comments(query: str) -> bool:
    """Check if the query contains any forbidden comment patterns."""
    return any(comment in query for comment in FORBIDDEN_COMMENTS)

def parse_condition(condition: str) -> Tuple[str, str, str]:
    """Parse a condition into column name, operator, and value."""
    # Remove any quotes around the value
    condition = condition.strip()
    
    # Handle BETWEEN conditions
    if "BETWEEN" in condition.upper():
        parts = condition.split("BETWEEN")
        if len(parts) != 2:
            raise ValueError("Invalid BETWEEN condition format")
        
        column = parts[0].strip()
        # Remove quotes if present
        if column.startswith(('"', "'")) and column.endswith(('"', "'")):
            column = column[1:-1]
        if not column:
            raise ValueError("Empty column name in BETWEEN condition")
        
        # Split the range values
        range_values = parts[1].strip().split("AND")
        if len(range_values) != 2:
            raise ValueError("Invalid BETWEEN range format")
        
        min_val = range_values[0].strip()
        max_val = range_values[1].strip()
        
        # Remove quotes if present
        if min_val.startswith(("'", '"')) and min_val.endswith(("'", '"')):
            min_val = min_val[1:-1]
        if max_val.startswith(("'", '"')) and max_val.endswith(("'", '"')):
            max_val = max_val[1:-1]
            
        return column, "BETWEEN", f"{min_val} AND {max_val}"
    
    # Handle IS NULL and IS NOT NULL cases
    if "IS NULL" in condition.upper():
        parts = condition.split("IS NULL")
        column = parts[0].strip()
        # Remove quotes if present
        if column.startswith(('"', "'")) and column.endswith(('"', "'")):
            column = column[1:-1]
        if not column:
            raise ValueError("Empty column name in IS NULL condition")
        return column, "IS NULL", None
    elif "IS NOT NULL" in condition.upper():
        parts = condition.split("IS NOT NULL")
        column = parts[0].strip()
        # Remove quotes if present
        if column.startswith(('"', "'")) and column.endswith(('"', "'")):
            column = column[1:-1]
        if not column:
            raise ValueError("Empty column name in IS NOT NULL condition")
        return column, "IS NOT NULL", None
    
    # Handle other operators
    operators = [op.value for op in Operator]
    for op in sorted(operators, key=len, reverse=True):
        if op in condition:
            parts = condition.split(op)
            if len(parts) == 2:
                column = parts[0].strip()
                # Remove quotes if present
                if column.startswith(('"', "'")) and column.endswith(('"', "'")):
                    column = column[1:-1]
                if not column:
                    raise ValueError(f"Empty column name before operator {op}")
                value = parts[1].strip()
                # Remove quotes if present
                if value.startswith(("'", '"')) and value.endswith(("'", '"')):
                    value = value[1:-1]
                return column, op, value
    
    raise ValueError(f"Could not parse condition: {condition}")

def validate_operator(operator: str) -> bool:
    """Validate that the operator is in the allowed set."""
    return operator in [op.value for op in Operator]

def sanitize_query(query: str) -> str:
    """Sanitize the query by removing any forbidden patterns and validating structure."""
    if contains_forbidden_keywords(query):
        raise ValueError("Query contains forbidden SQL keywords")
    
    if contains_forbidden_comments(query):
        raise ValueError("Query contains forbidden comment patterns")
    
    # Split the query into individual conditions
    conditions = [cond.strip() for cond in query.split("AND") if cond.strip()]
    
    sanitized_conditions = []
    for condition in conditions:
        try:
            column, operator, value = parse_condition(condition)
            
            # Validate column name
            if not column or not validate_column_name(column):
                raise ValueError(f"Invalid column name: {column}")
            
            if not validate_operator(operator):
                raise ValueError(f"Invalid operator: {operator}")
            
            # Quote column names - use single quotes to avoid conflicts with SQL string quotes
            if value is None:
                sanitized_conditions.append(f'"{column}" {operator}')
            elif operator == "BETWEEN":
                # For BETWEEN, we need to handle the range values separately
                min_val, max_val = value.split(" AND ")
                sanitized_conditions.append(f'"{column}" {operator} :val_{len(sanitized_conditions)} AND :val_{len(sanitized_conditions) + 1}')
            else:
                sanitized_conditions.append(f'"{column}" {operator} :val_{len(sanitized_conditions)}')
        except ValueError as e:
            raise ValueError(f"Invalid condition format: {str(e)}")
    
    if not sanitized_conditions:
        raise ValueError("No valid conditions found in query")
    
    return " AND ".join(sanitized_conditions)

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
        2. Do not include quotes around column names in the query - they will be added automatically.
        3. Use the exact column names as provided in the available columns list.
        4. Column names are case-sensitive, so use them exactly as they appear.
        5. Do not include table names in the query - they will be added automatically.
        6. The WHERE clause should only contain column names and conditions.
        7. Make sure to use the exact column names from the provided list.
        8. Column names in PostgreSQL are case-sensitive, so use them exactly as they appear in the list.
        9. The column names must match exactly, including case.
        10. Never use empty column names or values in the query.
        11. Always ensure the column name exists before the operator.
        12. Do not include any quotes around column names - they will be added automatically.
        13. Do not include quotes around column names in the query - they will be added automatically.
        14. For column names with spaces, use them exactly as they appear in the list.
        15. For comparison operators, use standard SQL operators: =, !=, >, <, >=, <=
        16. For numeric comparisons, ensure the value is a number without quotes.
        17. For string comparisons, ensure the value is in quotes.
        18. Always use the exact column name from the list, including spaces.
        19. For column names with spaces, use them exactly as they appear in the list.
        20. Do not modify the column names in any way - use them exactly as provided.
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
            
            # Validate the query format
            if not operation_dict["query"].strip():
                raise ValueError("Empty query string")
            
            # Validate that all column names in the query exist in the DataFrame
            query_lower = operation_dict["query"].lower()
            for column in columns:
                if column.lower() in query_lower:
                    # Replace the lowercase column name with the exact column name
                    operation_dict["query"] = operation_dict["query"].replace(column.lower(), column)
            
            # Ensure proper spacing around operators
            operation_dict["query"] = re.sub(r'\s*([=<>!]+)\s*', r' \1 ', operation_dict["query"])
            
            # Validate numeric values are not quoted
            operation_dict["query"] = re.sub(r'([=<>!]+)\s*[\'"](\d+)[\'"]', r'\1 \2', operation_dict["query"])
            
            # Log the final query for debugging
            logger.info(f"Final processed query: {operation_dict['query']}")
            
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

def get_current_version(db: Session, file_id: int) -> TableVersion:
    """Get the current version for a file."""
    return db.query(TableVersion).filter(
        TableVersion.file_id == file_id,
        TableVersion.is_current == True
    ).first()

def get_version_by_number(db: Session, file_id: int, version: int) -> TableVersion:
    """Get a specific version for a file."""
    return db.query(TableVersion).filter(
        TableVersion.file_id == file_id,
        TableVersion.version == version
    ).first()

def get_total_versions(db: Session, file_id: int) -> int:
    """Get the total number of versions for a file."""
    return db.query(TableVersion).filter(
        TableVersion.file_id == file_id
    ).count()

def create_version(db: Session, file_id: int, table_name: str, description: str) -> TableVersion:
    """Create a new version entry."""
    # Get the current highest version number
    latest_version = db.query(TableVersion).filter(
        TableVersion.file_id == file_id
    ).order_by(desc(TableVersion.version)).first()
    
    new_version_num = 1 if not latest_version else latest_version.version + 1
    
    # Set all existing versions to not current
    db.query(TableVersion).filter(
        TableVersion.file_id == file_id,
        TableVersion.is_current == True
    ).update({"is_current": False})
    
    # Create new version
    new_version = TableVersion(
        file_id=file_id,
        table_name=table_name,
        version=new_version_num,
        is_current=True,
        description=description
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    return new_version

@router.post("/api/data/filter")
async def filter_data(
    request: FilterRequest = Body(...),
    current_user=Depends(get_current_user),
    user_db: Session = Depends(get_user_db),
    data_db: Session = Depends(get_data_db)
):
    try:
        logger.info(f"Received filter request for file_id: {request.file_id}, query: {request.query}")
        
        # Check ownership using user_db
        file_record = user_db.query(File).filter(
            File.id == request.file_id, 
            File.user_id == current_user.id
        ).first()
        if not file_record:
            logger.error(f"File not found for id: {request.file_id}")
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get the source table name and validate it
        source_table = file_record.file_path
        if not validate_table_name(source_table):
            raise HTTPException(status_code=400, detail="Invalid table name")
        
        logger.info(f"Processing data from table: {source_table}")
        
        # Get the next available table name
        new_table = get_next_table_name(data_db, source_table)
        if not validate_table_name(new_table):
            raise HTTPException(status_code=400, detail="Invalid new table name")
        
        logger.info(f"Creating new table: {new_table}")
        
        # Get the actual column names from the current table using parameterized query
        with data_engine.connect() as connection:
            result = connection.execute(
                text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = :table_name
                """),
                {"table_name": source_table}
            )
            columns = [row[0] for row in result]
            logger.info(f"Found columns in table {source_table}: {columns}")
            
            # Validate all column names
            for column in columns:
                if not validate_column_name(column):
                    raise HTTPException(status_code=400, detail=f"Invalid column name: {column}")
            
            # Create a dummy DataFrame with the actual column names
            df = pd.DataFrame(columns=columns)
            
            # Process the natural language query
            operation_dict = process_natural_language_query(request.query, df)
            
            # Sanitize and validate the query
            try:
                sanitized_query = sanitize_query(operation_dict["query"])
                # Extract parameters from the original query
                params = {}
                conditions = [cond.strip() for cond in operation_dict["query"].split("AND") if cond.strip()]
                for i, condition in enumerate(conditions):
                    _, _, value = parse_condition(condition)
                    if value is not None:
                        params[f"val_{i}"] = value
            except ValueError as e:
                logger.error(f"Error sanitizing query: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Invalid query format: {str(e)}")
            
            logger.info(f"Using sanitized query: {sanitized_query}")
            logger.info(f"With parameters: {params}")
            
            try:
                # Create new table with filtered data
                create_new_table_from_query(data_db, source_table, new_table, sanitized_query, params)
            except Exception as e:
                logger.error(f"Error creating new table: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error creating filtered table: {str(e)}")
            
            # Create new version entry using data_db
            version = create_version(
                data_db,
                request.file_id,
                new_table,
                f"Applied filter: {operation_dict['description']}"
            )
            
            # Update file path to point to new version
            file_record.file_path = new_table
            user_db.commit()
            
            # Fetch the filtered data using parameterized query
            result = connection.execute(
                text(f"SELECT * FROM {new_table}")
            )
            # Convert the result to a list of dictionaries
            records = []
            for row in result:
                record = {}
                for i, col in enumerate(result.keys()):
                    record[col] = row[i]
                records.append(record)
            
            # Return the filtered data along with version information
            total_versions = get_total_versions(data_db, request.file_id)
            
            return {
                "data": records,
                "description": operation_dict["description"],
                "version": version.version,
                "total_versions": total_versions
            }
        
    except Exception as e:
        logger.error(f"Error filtering data: {str(e)}")
        logger.error(f"Full error details: {str(e.__class__.__name__)}: {str(e)}")
        if hasattr(e, 'orig'):
            logger.error(f"Original error: {str(e.orig)}")
        raise HTTPException(status_code=500, detail=f"Error filtering data: {str(e)}")

@router.post("/api/data/undo")
async def undo_filter(
    file_id: int,
    current_user=Depends(get_current_user),
    user_db: Session = Depends(get_user_db),
    data_db: Session = Depends(get_data_db)
) -> UndoRedoResponse:
    try:
        # Check ownership using user_db
        file_record = user_db.query(File).filter(
            File.id == file_id,
            File.user_id == current_user.id
        ).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get current version using data_db
        current_version = get_current_version(data_db, file_id)
        if not current_version or current_version.version <= 1:
            raise HTTPException(status_code=400, detail="No previous version available")
        
        # Get previous version using data_db
        prev_version = get_version_by_number(data_db, file_id, current_version.version - 1)
        if not prev_version:
            raise HTTPException(status_code=404, detail="Previous version not found")
        
        # Update current version flag using data_db
        current_version.is_current = False
        prev_version.is_current = True
        data_db.commit()
        
        # Update file path to point to previous version using user_db
        file_record.file_path = prev_version.table_name
        user_db.commit()
        
        # Fetch data from the previous version
        with data_engine.connect() as connection:
            result = connection.execute(text(f"SELECT * FROM {prev_version.table_name}"))
            records = [dict(row._mapping) for row in result]
        
        total_versions = get_total_versions(data_db, file_id)
        
        return UndoRedoResponse(
            success=True,
            message=f"Successfully reverted to version {prev_version.version}",
            current_version=prev_version.version,
            total_versions=total_versions,
            data=records
        )
        
    except Exception as e:
        logger.error(f"Error in undo operation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in undo operation: {str(e)}")

@router.post("/api/data/redo")
async def redo_filter(
    file_id: int,
    current_user=Depends(get_current_user),
    user_db: Session = Depends(get_user_db),
    data_db: Session = Depends(get_data_db)
) -> UndoRedoResponse:
    try:
        # Check ownership using user_db
        file_record = user_db.query(File).filter(
            File.id == file_id,
            File.user_id == current_user.id
        ).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get current version using data_db
        current_version = get_current_version(data_db, file_id)
        if not current_version:
            raise HTTPException(status_code=400, detail="No current version found")
        
        # Get next version using data_db
        next_version = get_version_by_number(data_db, file_id, current_version.version + 1)
        if not next_version:
            raise HTTPException(status_code=400, detail="No next version available")
        
        # Update current version flag using data_db
        current_version.is_current = False
        next_version.is_current = True
        data_db.commit()
        
        # Update file path to point to next version using user_db
        file_record.file_path = next_version.table_name
        user_db.commit()
        
        # Fetch data from the next version
        with data_engine.connect() as connection:
            result = connection.execute(text(f"SELECT * FROM {next_version.table_name}"))
            records = [dict(row._mapping) for row in result]
        
        total_versions = get_total_versions(data_db, file_id)
        
        return UndoRedoResponse(
            success=True,
            message=f"Successfully moved to version {next_version.version}",
            current_version=next_version.version,
            total_versions=total_versions,
            data=records
        )
        
    except Exception as e:
        logger.error(f"Error in redo operation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in redo operation: {str(e)}")

@router.get("/api/data/history/{file_id}")
async def get_version_history(
    file_id: int,
    current_user=Depends(get_current_user),
    user_db: Session = Depends(get_user_db),
    data_db: Session = Depends(get_data_db)
):
    try:
        file_record = user_db.query(File).filter(
            File.id == file_id, 
            File.user_id == current_user.id
        ).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        versions = data_db.query(TableVersion).filter(
            TableVersion.file_id == file_id
        ).order_by(TableVersion.version.asc()).all()

        version_data = []
        with data_engine.connect() as conn:
            for version in versions:
                result = conn.execute(text(f"SELECT * FROM {version.table_name}"))
                records = [dict(row._mapping) for row in result]
                version_data.append({
                    "version": version.version,
                    "is_current": version.is_current,
                    "description": version.description,
                    "data": records
                })

        return version_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching version history: {str(e)}")

@router.delete("/api/data/history/{file_id}/{version}")
async def delete_version(
    file_id: int,
    version: int,
    current_user=Depends(get_current_user),
    user_db: Session = Depends(get_user_db),
    data_db: Session = Depends(get_data_db)
):
    """Delete a specific version of a file (if owned by the current user)"""
    try:
        # Check ownership using user_db
        file_record = user_db.query(File).filter(
            File.id == file_id,
            File.user_id == current_user.id
        ).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get the version to delete
        version_to_delete = data_db.query(TableVersion).filter(
            TableVersion.file_id == file_id,
            TableVersion.version == version
        ).first()
        
        if not version_to_delete:
            raise HTTPException(status_code=404, detail="Version not found")
            
        # Don't allow deleting the initial version (version 1)
        if version == 1:
            raise HTTPException(status_code=400, detail="Cannot delete the initial version")
            
        # If this is the current version, we need to set a new current version
        if version_to_delete.is_current:
            # Find the previous version
            prev_version = data_db.query(TableVersion).filter(
                TableVersion.file_id == file_id,
                TableVersion.version < version
            ).order_by(TableVersion.version.desc()).first()
            
            if not prev_version:
                raise HTTPException(status_code=400, detail="Cannot delete the only remaining version")
                
            # Set the previous version as current
            prev_version.is_current = True
            file_record.file_path = prev_version.table_name
            user_db.commit()
        
        # Get the table name before deleting the version record
        table_name = version_to_delete.table_name
        
        # Delete the version from the database
        data_db.delete(version_to_delete)
        data_db.commit()
        
        # Drop the table
        with data_engine.connect() as conn:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
                conn.commit()
            except Exception as e:
                logger.error(f"Error dropping table {table_name}: {str(e)}")
                # Continue with the response even if table drop fails
                # The table might have already been dropped or not exist
        
        return {"message": f"Version {version} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting version: {str(e)}")
        # Rollback any pending changes
        data_db.rollback()
        user_db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting version: {str(e)}") 