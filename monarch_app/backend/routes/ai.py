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
import matplotlib.pyplot as plt
import seaborn as sns
import plotly
import plotly.tools as plotly_tools
import numpy as np
import plotly.graph_objects as go
import ast
import subprocess
import signal
from contextlib import contextmanager
import tempfile
import json
import io
import base64
import traceback

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
        # Helper function to convert numpy/pandas types to Python native types
        def convert_to_native_types(obj):
            if isinstance(obj, (np.integer, np.int64)):
                return int(obj)
            elif isinstance(obj, (np.floating, np.float64)):
                return float(obj)
            elif isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.datetime64):
                return str(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, pd.Series):
                return obj.apply(convert_to_native_types).tolist()
            elif isinstance(obj, dict):
                return {k: convert_to_native_types(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_to_native_types(item) for item in obj]
            elif pd.isna(obj):
                return None
            elif isinstance(obj, pd.Timestamp):
                return obj.isoformat()
            elif isinstance(obj, np.dtype):
                return str(obj)
            return obj

        # Convert DataFrame to a more detailed format for the model
        data_description = {
            "columns": list(df.columns),
            "shape": list(df.shape),
            "dtypes": {str(k): str(v) for k, v in df.dtypes.to_dict().items()},
            "summary": {
                "numeric": convert_to_native_types(df.describe().to_dict()),
                "categorical": convert_to_native_types({
                    col: df[col].value_counts().to_dict() 
                    for col in df.select_dtypes(include=['object']).columns
                })
            },
            "sample": convert_to_native_types(df.head(10).to_dict()),
            "missing_values": convert_to_native_types(df.isnull().sum().to_dict()),
            "unique_counts": convert_to_native_types({col: df[col].nunique() for col in df.columns})
        }

        # Create the base prompt that enforces using the existing DataFrame
        base_prompt = f"""You are analyzing an existing DataFrame that is already loaded and available as 'df'.
DO NOT create sample data or new DataFrames. The data is already loaded and available.
ALWAYS use the existing 'df' variable directly in your code.
NEVER generate random data or create new DataFrames.

DataFrame Information:
- Shape: {df.shape}
- Columns: {list(df.columns)}
- Data Types: {data_description['dtypes']}

User Query: {query}

When writing code:
1. ALWAYS use the existing 'df' variable
2. NEVER create new sample data
3. NEVER use pd.DataFrame() to create new data
4. NEVER use np.random or random functions
5. The data is already loaded - just use 'df' directly

Example of correct code:
```python
# Good - uses existing df
plt.figure(figsize=(10, 6))
sns.lineplot(data=df, x=df.index, y='column_name')
plt.title('Analysis of Existing Data')
plt.show()
```

Example of incorrect code (DO NOT DO THIS):
```python
# BAD - never create sample data
data = np.random.normal(size=100)  # DON'T DO THIS
df = pd.DataFrame(...)  # DON'T DO THIS
```"""

        # Add analysis type specific instructions
        if analysis_type == 'summary':
            prompt = base_prompt + """

Please provide a concise summary focusing on key insights and patterns from the existing data.
Include specific numbers and statistics from the actual data."""

        elif analysis_type == 'report':
            prompt = base_prompt + """

Please provide a comprehensive report including:
1. Executive Summary
2. Key Findings (with specific numbers from the actual data)
3. Data Quality Assessment
4. Statistical Analysis
5. Recommendations for Visualization
6. Actionable Insights

Use specific values and statistics from the existing data."""

        else:  # general analysis
            prompt = base_prompt + """

Please provide a detailed analysis based on the query. Include:
1. Relevant statistics and actual values from the existing data
2. Key patterns and trends
3. Notable outliers or anomalies
4. Recommendations based on the actual data
5. Suggested visualizations using the existing columns"""

        # Add format instruction
        if format == 'bullet':
            prompt += "\n\nPlease format your response using bullet points for better readability."
        else:
            prompt += "\n\nPlease format your response in clear paragraphs."

        # Add code and plot formatting instructions
        prompt += """

When including code or plots:
1. ALWAYS use the existing 'df' DataFrame
2. For plots, use matplotlib or plotly
3. Use clear variable names and add comments
4. Include titles and axis labels
5. Use appropriate color schemes
6. Use the actual column names from df
7. Reference actual values from the data

Remember: The data is already loaded in the 'df' variable - just use it directly."""

        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )

        return response.text

    except Exception as e:
        logger.error(f"Error analyzing data: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

@router.post("/api/ai/analyze")
async def analyze_request(
    request: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get the file ID from the request
        file_id = request.get("fileId")
        if not file_id:
            raise HTTPException(
                status_code=400,
                detail="No file ID provided"
            )

        # Get the specified file
        current_file = db.query(File).filter(
            File.id == file_id,
            File.user_id == current_user.id
        ).first()

        if not current_file:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        # Get the data from the current file
        df = get_current_file_data(current_file.file_path)

        # Clean and preprocess the data
        # Handle missing values
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        df = df.replace({pd.NaT: None})

        # Convert dates to string format for JSON serialization
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        # Analyze the data using Gemini
        analysis = analyze_data(
            request["query"], 
            df, 
            request.get('format', 'paragraph'),
            request.get('analysisType', 'general')
        )

        # Convert DataFrame to records for response
        records = df.to_dict('records')

        return {
            "response": analysis,
            "data": records,
            "file_info": {
                "filename": current_file.filename,
                "file_type": current_file.file_type,
                "columns": list(df.columns),
                "row_count": len(df),
                "column_count": len(df.columns)
            }
        }

    except Exception as e:
        logger.error(f"Error in analyze_request: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing data: {str(e)}"
        )

@router.post("/api/ai/execute-code")
async def execute_code(
    request: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get the file ID and code from the request
        file_id = request.get("fileId")
        code = request.get("code")

        if not file_id:
            raise HTTPException(
                status_code=400,
                detail="No file ID provided"
            )

        if not code:
            raise HTTPException(
                status_code=400,
                detail="No code provided"
            )

        # Get the specified file
        current_file = db.query(File).filter(
            File.id == file_id,
            File.user_id == current_user.id
        ).first()

        if not current_file:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        # Get the actual data from the database
        df = get_current_file_data(current_file.file_path)

        # Clean and preprocess the data
        # Handle missing values
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        df = df.replace({pd.NaT: None})

        # Helper function to detect date format
        def detect_date_format(series):
            # Common date formats to try
            formats = [
                '%Y-%m-%d',
                '%Y/%m/%d',
                '%d-%m-%Y',
                '%d/%m/%Y',
                '%Y-%m-%d %H:%M:%S',
                '%Y/%m/%d %H:%M:%S',
                '%d-%m-%Y %H:%M:%S',
                '%d/%m/%Y %H:%M:%S'
            ]
            
            # Get a sample of non-null values
            sample = series.dropna().head(100)
            if len(sample) == 0:
                return None
            
            # Try each format
            for fmt in formats:
                try:
                    pd.to_datetime(sample, format=fmt)
                    return fmt
                except (ValueError, TypeError):
                    continue
            
            return None

        # Convert dates to datetime if they exist
        for col in df.columns:
            try:
                if df[col].dtype == 'object':
                    # Try to detect date format
                    date_format = detect_date_format(df[col])
                    if date_format:
                        # Convert using detected format
                        df[col] = pd.to_datetime(df[col], format=date_format)
                        logger.info(f"Converted column {col} to datetime using format {date_format}")
                    else:
                        # Try pandas' built-in parser as a fallback
                        try:
                            df[col] = pd.to_datetime(df[col])
                            logger.info(f"Converted column {col} to datetime using automatic format detection")
                        except (ValueError, TypeError):
                            pass
            except Exception as e:
                logger.warning(f"Could not convert column {col} to datetime: {str(e)}")

        try:
            # Create temp Python script with actual data
            with tempfile.TemporaryDirectory() as temp_dir:
                script_path = os.path.join(temp_dir, 'script.py')
                data_path = os.path.join(temp_dir, 'data.csv')
                
                # Save the DataFrame to a temporary CSV file
                df.to_csv(data_path, index=True)
                
                with open(script_path, 'w') as script_file:
                    script_file.write(f"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
import plotly.express as px
import json
import io
import base64
import traceback
import sys
import math
import statistics

plt.switch_backend('Agg')
plt.style.use('seaborn')  # Use seaborn style for better looking plots

def main():
    text_output = ""
    error_message = ""
    error_trace = ""
    
    try:
        # Load the actual DataFrame from the saved CSV
        df = pd.read_csv('{data_path}')
        
        # Convert date columns to datetime
        for col in df.columns:
            if 'date' in col.lower() or 'time' in col.lower():
                try:
                    df[col] = pd.to_datetime(df[col])
                except:
                    pass
        
        # If there's a date/time column, set it as index
        date_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col])]
        if date_cols:
            df = df.set_index(date_cols[0])
        
        print("DataFrame loaded successfully with shape:", df.shape, file=sys.stderr)
        print("Columns:", df.columns.tolist(), file=sys.stderr)

        # Set up plot style
        plt.rcParams['figure.figsize'] = [12, 6]
        plt.rcParams['figure.dpi'] = 100
        plt.rcParams['font.size'] = 10
        plt.rcParams['axes.titlesize'] = 14
        plt.rcParams['axes.labelsize'] = 12
        plt.rcParams['axes.grid'] = True
        plt.rcParams['grid.alpha'] = 0.3

        # Capture stdout
        old_stdout = sys.stdout
        new_stdout = io.StringIO()
        sys.stdout = new_stdout

        # Run user code
        exec({repr(code)})

        # Restore stdout
        sys.stdout = old_stdout
        text_output = new_stdout.getvalue()

        # If a plot is generated
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', dpi=100, 
                       facecolor='white', edgecolor='none')
            buf.seek(0)
            plt.close('all')
            plot_data = base64.b64encode(buf.getvalue()).decode('utf-8')
            print(json.dumps({{"type": "plot", "data": plot_data, "text": text_output}}))
        else:
            print(json.dumps({{"type": "text", "result": text_output or "No output generated"}}))

    except Exception as e:
        error_message = str(e)
        error_trace = traceback.format_exc()
        print(json.dumps({{"type": "error", "error": error_message, "trace": error_trace, "text": text_output}}))

if __name__ == "__main__":
    main()
""")

                try:
                    # Run the script with timeout
                    result = subprocess.run(
                        ['python', script_path],
                        capture_output=True,
                        text=True,
                        timeout=30  # 30 seconds timeout
                    )

                    if result.returncode != 0:
                        logger.error(f"Script execution failed: {result.stderr}")
                        return {"type": "error", "error": f"Code execution failed: {result.stderr.strip()}"}

                    output = result.stdout.strip()
                    if output:
                        try:
                            response_data = json.loads(output)
                            return response_data
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse output: {str(e)}")
                            return {"type": "error", "error": "Failed to parse output from executed code"}

                    return {"type": "text", "result": "No output returned."}

                except subprocess.TimeoutExpired:
                    logger.error("Code execution timed out")
                    return {"type": "error", "error": "Code execution timed out"}

        except Exception as e:
            logger.error(f"Execution preparation failed: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {"type": "error", "error": f"Error preparing code execution: {str(e)}"}

    except Exception as e:
        logger.error(f"Error in execute_code: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error executing code: {str(e)}"
        ) 