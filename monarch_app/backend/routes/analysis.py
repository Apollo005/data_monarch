from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from routes.auth import get_current_user
from database.users import SessionLocal
from database.files import engine as data_engine
from database.tables import File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_squared_error, accuracy_score, precision_score, recall_score, f1_score
import logging
from sqlalchemy import text
import re

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

def sanitize_column_name(column_name: str) -> str:
    """Properly format column name for SQL query."""
    # Remove any existing quotes
    column_name = column_name.strip('"\'')
    # Replace any double quotes with single quotes for PostgreSQL
    column_name = column_name.replace('"', '""')
    # Wrap in double quotes
    return f'"{column_name}"'

def sanitize_float(value):
    """Convert infinite or NaN values to None for JSON serialization."""
    if isinstance(value, (int, float)):
        if np.isnan(value) or np.isinf(value):
            return None
        return float(value)
    return value

def sanitize_dict(d):
    """Recursively sanitize dictionary values for JSON serialization."""
    return {k: sanitize_float(v) if isinstance(v, (int, float)) else v for k, v in d.items()}

class RegressionRequest(BaseModel):
    file_id: int = Field(..., description="ID of the file to analyze")
    target_column: str = Field(..., description="Name of the target column")
    feature_columns: List[str] = Field(..., description="List of feature column names")
    regression_type: str = Field(..., description="Type of regression (linear or logistic)")
    test_size: float = Field(default=0.2, ge=0.1, le=0.9, description="Test set size (between 0.1 and 0.9)")
    random_state: int = Field(default=42, description="Random state for reproducibility")

    @validator('regression_type')
    def validate_regression_type(cls, v):
        if v not in ['linear', 'logistic']:
            raise ValueError('regression_type must be either "linear" or "logistic"')
        return v

    @validator('feature_columns')
    def validate_feature_columns(cls, v):
        if not v:
            raise ValueError('feature_columns cannot be empty')
        return v

@router.post("/api/analysis/regression")
async def perform_regression_analysis(
    request: RegressionRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Received regression request: {request.dict()}")
        
        # Verify file ownership
        file_record = db.query(File).filter(
            File.id == request.file_id,
            File.user_id == current_user.id
        ).first()
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")

        # Get data from the table
        table_name = file_record.file_path
        
        try:
            with data_engine.connect() as connection:
                # Verify columns exist
                columns_query = text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = :table_name
                """)
                result = connection.execute(columns_query, {"table_name": table_name})
                available_columns = [row[0] for row in result]
                
                # Check if all requested columns exist
                missing_columns = []
                if request.target_column not in available_columns:
                    missing_columns.append(request.target_column)
                for col in request.feature_columns:
                    if col not in available_columns:
                        missing_columns.append(col)
                
                if missing_columns:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Columns not found in dataset: {', '.join(missing_columns)}"
                    )

                # Fetch only required columns
                columns = [request.target_column] + request.feature_columns
                columns_str = ', '.join(f'"{col}"' for col in columns)
                query = text(f"SELECT {columns_str} FROM {table_name}")
                
                df = pd.read_sql_query(query, connection)
                
                if df.empty:
                    raise HTTPException(
                        status_code=400,
                        detail="No data found in the selected columns"
                    )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching data from database: {str(e)}"
            )

        # Check for missing values
        missing_columns = df.columns[df.isnull().any()].tolist()
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing values found in columns: {', '.join(missing_columns)}"
            )

        # Replace infinite values with NaN
        df = df.replace([np.inf, -np.inf], np.nan)
        
        # Drop rows with NaN values
        df = df.dropna()
        
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="No valid data remains after removing missing and infinite values"
            )

        # Prepare features and target
        X = df[request.feature_columns]
        y = df[request.target_column]

        # Additional validation for regression type
        if request.regression_type == 'logistic':
            unique_values = y.nunique()
            if unique_values > 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Logistic regression requires binary target variable, but found {unique_values} unique values"
                )
        elif request.regression_type == 'linear':
            if not np.issubdtype(y.dtype, np.number):
                raise HTTPException(
                    status_code=400,
                    detail="Linear regression requires numeric target variable"
                )

        try:
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y,
                test_size=request.test_size,
                random_state=request.random_state
            )

            # Initialize and train model based on regression type
            if request.regression_type == 'linear':
                model = LinearRegression()
                # Skip feature scaling for simple regression
                model.fit(X, y)  # Use original X instead of X_scaled
                y_pred = model.predict(X_test)

                # Calculate metrics
                metrics = {
                    'r2_score': float(r2_score(y_test, y_pred)),
                    'mse': float(mean_squared_error(y_test, y_pred)),
                    'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred)))
                }

                # Get coefficients and feature importance
                coefficients = dict(zip(request.feature_columns, model.coef_))
                feature_importance = {
                    col: abs(coef) for col, coef in coefficients.items()
                }

                # Sort feature importance
                feature_importance = dict(
                    sorted(feature_importance.items(), key=lambda x: abs(x[1]), reverse=True)
                )

                # Sanitize values for JSON serialization
                metrics = sanitize_dict(metrics)
                coefficients = sanitize_dict(coefficients)
                feature_importance = sanitize_dict(feature_importance)

                # Generate equation string for linear regression
                equation = f"y = {model.intercept_:.4f}"
                for feature, coef in coefficients.items():
                    if coef >= 0:
                        equation += f" + {coef:.4f} × {feature}"
                    else:
                        equation += f" - {abs(coef):.4f} × {feature}"

                response = {
                    'metrics': metrics,
                    'coefficients': coefficients,
                    'intercept': float(model.intercept_),
                    'equation': equation,
                    'feature_importance': feature_importance,
                    'predictions': y_pred.tolist()
                }

                return response

            else:  # logistic regression
                model = LogisticRegression(random_state=request.random_state)
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)

                # Calculate metrics
                metrics = {
                    'accuracy': float(accuracy_score(y_test, y_pred)),
                    'precision': float(precision_score(y_test, y_pred, zero_division=0)),
                    'recall': float(recall_score(y_test, y_pred, zero_division=0)),
                    'f1_score': float(f1_score(y_test, y_pred, zero_division=0))
                }

                # Get coefficients and feature importance
                coefficients = dict(zip(request.feature_columns, model.coef_[0]))
                feature_importance = {
                    col: abs(coef) for col, coef in coefficients.items()
                }

                # Sort feature importance
                feature_importance = dict(
                    sorted(feature_importance.items(), key=lambda x: abs(x[1]), reverse=True)
                )

                # Sanitize values for JSON serialization
                metrics = sanitize_dict(metrics)
                coefficients = sanitize_dict(coefficients)
                feature_importance = sanitize_dict(feature_importance)

                return {
                    'metrics': metrics,
                    'coefficients': coefficients,
                    'intercept': sanitize_float(float(model.intercept_[0])),
                    'feature_importance': feature_importance
                }

        except Exception as e:
            logger.error(f"Model training error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error during model training: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing regression analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error performing regression analysis: {str(e)}"
        ) 