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

        # Add code and plot formatting instructions
        prompt += """

When including code or plots:
1. For code blocks, use triple backticks with the language specified (e.g., ```python)
2. For plots, include the code to generate them using matplotlib or plotly
3. Make sure all code is executable and includes necessary imports
4. Use clear variable names and add comments for clarity
5. For plots, include a title and axis labels
6. Use appropriate color schemes and styling

Example code block format:
```python
import matplotlib.pyplot as plt
import seaborn as sns

# Create a plot
plt.figure(figsize=(10, 6))
sns.boxplot(data=df, x='column1', y='column2')
plt.title('Distribution of Column2 by Column1')
plt.show()
```

Example plot format:
```plot
import matplotlib.pyplot as plt
import seaborn as sns

# Create a plot
plt.figure(figsize=(10, 6))
sns.boxplot(data=df, x='column1', y='column2')
plt.title('Distribution of Column2 by Column1')
plt.show()
```"""

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

# Allowed imports and functions
ALLOWED_IMPORTS = {
    'pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'plotly.graph_objects',
    'plotly.express', 'plotly.tools', 'plotly.subplots', 'math', 'statistics',
    'scipy', 'scipy.stats', 'sklearn', 'sklearn.preprocessing', 'sklearn.metrics', 'matplotlib.pyplot'
}

ALLOWED_FUNCTIONS = {
    # Matplotlib functions
    'plt.figure', 'plt.plot', 'plt.scatter', 'plt.bar', 'plt.hist', 'plt.boxplot',
    'plt.title', 'plt.xlabel', 'plt.ylabel', 'plt.legend', 'plt.show', 'plt.grid',
    'plt.subplot', 'plt.subplots', 'plt.tight_layout', 'plt.savefig', 'plt.close',
    'plt.rcParams', 'plt.style', 'plt.axhline', 'plt.axvline', 'plt.fill_between',
    'plt.pie', 'plt.pcolormesh', 'plt.contour', 'plt.contourf', 'plt.imshow',
    
    # Seaborn functions
    'sns.boxplot', 'sns.scatterplot', 'sns.lineplot', 'sns.barplot', 'sns.heatmap',
    'sns.distplot', 'sns.jointplot', 'sns.pairplot', 'sns.violinplot', 'sns.countplot',
    'sns.regplot', 'sns.lmplot', 'sns.set_style', 'sns.set_context', 'sns.set_palette',
    'sns.kdeplot', 'sns.rugplot', 'sns.stripplot', 'sns.swarmplot', 'sns.catplot',
    
    # Plotly functions
    'go.Figure', 'go.Scatter', 'go.Bar', 'go.Histogram', 'go.Box', 'go.Heatmap',
    'go.Pie', 'go.Scatter3d', 'go.Surface', 'go.Layout', 'go.FigureWidget',
    'plotly.express.line', 'plotly.express.scatter', 'plotly.express.bar',
    'plotly.express.histogram', 'plotly.express.box', 'plotly.express.violin',
    'plotly.express.heatmap', 'plotly.express.pie', 'plotly.express.scatter_3d',
    
    # Pandas functions
    'pd.DataFrame', 'pd.Series', 'pd.read_csv', 'pd.to_datetime', 'pd.concat',
    'pd.merge', 'pd.pivot_table', 'pd.crosstab', 'pd.get_dummies', 'pd.qcut',
    'pd.cut', 'pd.melt', 'pd.pivot', 'pd.melt', 'pd.wide_to_long',
    
    # Numpy functions
    'np.array', 'np.zeros', 'np.ones', 'np.linspace', 'np.arange', 'np.random',
    'np.mean', 'np.median', 'np.std', 'np.var', 'np.corrcoef', 'np.polyfit',
    'np.percentile', 'np.quantile', 'np.histogram', 'np.unique', 'np.sort', 'np.fft.fft', 'np.fft.fftfreq', 'np.abs',
    
    # Statistics functions
    'statistics.mean', 'statistics.median', 'statistics.mode', 'statistics.stdev',
    'statistics.variance', 'statistics.quantiles', 'statistics.correlation',
    
    # Math functions
    'math.sqrt', 'math.log', 'math.exp', 'math.pow', 'math.factorial',
    'math.gamma', 'math.erf', 'math.erfc'
}

@contextmanager
def timeout(seconds):
    def signal_handler(signum, frame):
        raise TimeoutError("Code execution timed out")
    
    # Set the signal handler and a timer
    signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    
    try:
        yield
    finally:
        # Disable the alarm
        signal.alarm(0)

def validate_code(code: str) -> bool:
    """Validate code for security and allowed operations."""
    try:
        tree = ast.parse(code)
        
        # Check for dangerous imports and operations
        for node in ast.walk(tree):
            # Check for dangerous imports
            if isinstance(node, ast.Import):
                for name in node.names:
                    if name.name not in ALLOWED_IMPORTS:
                        return False
            elif isinstance(node, ast.ImportFrom):
                if node.module not in ALLOWED_IMPORTS:
                    return False
            
            # Check for dangerous operations
            if isinstance(node, ast.Call):
                # Check for dangerous function calls
                if isinstance(node.func, ast.Attribute):
                    if isinstance(node.func.value, ast.Name):
                        func_name = f"{node.func.value.id}.{node.func.attr}"
                        if func_name not in ALLOWED_FUNCTIONS:
                            # Allow any matplotlib/seaborn/plotly function calls
                            if not any(func_name.startswith(prefix) for prefix in ['plt.', 'sns.', 'go.', 'plotly.','pd.','df.']):
                                return False
                
                # Check for dangerous built-in functions
                if isinstance(node.func, ast.Name):
                    if node.func.id in ['eval', 'exec', 'input', 'open', 'os', 'sys', 'subprocess']:
                        return False
            
            # Check for dangerous operations
            if isinstance(node, (ast.While, ast.For)):
                # Check for infinite loops
                if isinstance(node.body, list) and len(node.body) == 0:
                    return False
            
            # Check for file operations
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in ['open', 'file']:
                    return False
            
            # Check for system operations
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr in ['system', 'popen', 'call']:
                    return False
        
        return True
    except Exception as e:
        logger.error(f"Code validation error: {str(e)}")
        return False

def execute_code_safely(code: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Execute code in a safe environment with timeouts and resource limits."""
    try:
        # Validate code before execution
        if not validate_code(code):
            logger.error("Code validation failed")
            return {"type": "error", "error": "Code contains forbidden operations or imports"}

        # Create a temporary directory for our files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save DataFrame to a temp CSV
            df_csv_path = os.path.join(temp_dir, 'data.csv')
            df.to_csv(df_csv_path, index=False)
            logger.info(f"Saved DataFrame to {df_csv_path}")

            # Create temp Python script
            script_path = os.path.join(temp_dir, 'script.py')
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

def main():
    # Initialize text output
    text_output = ""
    error_message = ""
    error_trace = ""
    
    try:
        # Load DataFrame
        df = pd.read_csv("{df_csv_path}")
        df = df.reset_index(drop=True)
        print("DataFrame loaded successfully", file=sys.stderr)

        # Capture stdout
        old_stdout = sys.stdout
        new_stdout = io.StringIO()
        sys.stdout = new_stdout

        # Run user code
        exec({repr(code)})

        # Restore stdout
        sys.stdout = old_stdout
        text_output = new_stdout.getvalue()
        print("Text output:", text_output, file=sys.stderr)

        # If a plot is generated
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
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
            logger.info(f"Created script at {script_path}")

            try:
                # Run the script with timeout
                with timeout(5):
                    result = subprocess.run(
                        ['python', script_path],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )

                    if result.returncode != 0:
                        logger.error(f"Script execution failed: {result.stderr}")
                        return {"type": "error", "error": f"Code execution failed: {result.stderr.strip()}"}

                    output = result.stdout.strip()
                    if output:
                        response_data = json.loads(output)
                        if response_data.get("type") == "error":
                            logger.error(f"Error in code: {response_data['error']}")
                            return response_data
                        return response_data

                    return {"type": "text", "result": "No output returned."}

            except TimeoutError:
                logger.error("Code execution timed out")
                return {"type": "error", "error": "Code execution timed out"}
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse output: {str(e)}")
                return {"type": "error", "error": "Failed to parse output from executed code"}

    except Exception as e:
        logger.error(f"Execution preparation failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"type": "error", "error": f"Error preparing code execution: {str(e)}"}

@router.post("/api/ai/execute-code")
async def execute_code(
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
            raise HTTPException(
                status_code=404,
                detail="Please upload a file first before executing code."
            )

        # Get the data from the current file
        df = get_current_file_data(current_file.file_path)

        # Get the code from the request
        code = request.get("code")
        if not code:
            raise HTTPException(
                status_code=400,
                detail="No code provided"
            )

        # Execute the code safely
        result = execute_code_safely(code, df)
        
        if result["type"] == "error":
            raise HTTPException(
                status_code=500,
                detail=result["error"]
            )
        
        if result["type"] == "plot":
            return {
                "result": {
                    "plot": {
                        "data": result["data"],
                        "type": "image/png"
                    }
                }
            }
        else:
            return {"result": result["result"]}

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in execute_code: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error executing code: {str(e)}"
        ) 