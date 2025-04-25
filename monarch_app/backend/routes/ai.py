from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from routes.auth import get_current_user
from database.users import SessionLocal
from database.tables import File
from typing import Dict, Any
from google import genai
import os
from dotenv import load_dotenv
import logging
import pandas as pd
from sqlalchemy import text
from database.files import engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize Gemini client
client = genai.Client(api_key=os.getenv("GENAI_API_KEY"))
logger.info("Gemini API key loaded successfully")

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_file_data(file_path: str) -> pd.DataFrame:
    """Get the current data from the database table."""
    try:
        with engine.connect() as connection:
            query = text(f"SELECT * FROM {file_path}")
            result = connection.execute(query)
            df = pd.DataFrame(result.fetchall(), columns=result.keys())
            return df
    except Exception as e:
        logger.error(f"Error fetching data from table {file_path}: {str(e)}")
        raise

def analyze_data(query: str, df: pd.DataFrame, format: str = 'paragraph', analysis_type: str = 'general') -> str:
    """Use Gemini to analyze the data based on the user's query."""
    try:
        # Get basic data info
        data_info = {
            "columns": list(df.columns),
            "shape": df.shape,
            "dtypes": df.dtypes.to_dict(),
            "sample": df.head(5).to_dict()
        }

        # Create the prompt based on analysis type
        if analysis_type == 'summary':
            prompt = f"""As a data analyst, provide a concise summary of this dataset:

Data Info:
- Columns: {data_info['columns']}
- Shape: {data_info['shape']}
- Data Types: {data_info['dtypes']}
- Sample Data: {data_info['sample']}

User Query: {query}

Please provide a clear and concise summary. Focus on key insights and patterns."""
        elif analysis_type == 'report':
            prompt = f"""As a data analyst, provide a detailed report on this dataset:

Data Info:
- Columns: {data_info['columns']}
- Shape: {data_info['shape']}
- Data Types: {data_info['dtypes']}
- Sample Data: {data_info['sample']}

User Query: {query}

Please provide a comprehensive report including:
1. Executive Summary
2. Key Findings
3. Data Quality Assessment
4. Statistical Analysis
5. Visualizations (if applicable)
6. Recommendations"""
        else:  # general analysis
            prompt = f"""As a data analyst, help me analyze this dataset:

Data Info:
- Columns: {data_info['columns']}
- Shape: {data_info['shape']}
- Data Types: {data_info['dtypes']}
- Sample Data: {data_info['sample']}

User Query: {query}

Please provide a detailed analysis based on the query. Include relevant statistics, insights, and recommendations."""

        # Add format instruction
        if format == 'bullet':
            prompt += "\n\nPlease format your response using bullet points for better readability."
        else:
            prompt += "\n\nPlease format your response in clear paragraphs."

        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )

        return response.text

    except Exception as e:
        logger.error(f"Error analyzing data: {str(e)}")
        raise

@router.post("/api/ai/analyze")
async def analyze_request(
    request: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get the user's current file
        current_file = db.query(File).filter(
            File.user_id == current_user.id
        ).order_by(File.updated_at.desc()).first()

        if not current_file:
            return {
                "response": "Please upload a file first before asking for analysis."
            }

        # Get the data from the current file
        df = get_current_file_data(current_file.file_path)

        # Get format and analysis type from request
        format = request.get('format', 'paragraph')
        analysis_type = request.get('analysisType', 'general')

        # Analyze the data using Gemini
        analysis = analyze_data(request["query"], df, format, analysis_type)

        return {"response": analysis}

    except Exception as e:
        logger.error(f"Error in analyze_request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing data: {str(e)}"
        ) 