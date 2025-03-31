import pandas as pd
import re
import os

def sanitize_table_name(file_name: str) -> str:
    #remove any non-alphabetic characters, replace spaces with underscores, and ensure it's not too long
    sanitized_name = re.sub(r'\W|^(?=\d)', '_', file_name)
    return sanitized_name[:63]

def sanitize_string_input(value):
    #clean up strings to replace newlines and extra spaces
    if isinstance(value, str):
        # Replace newlines with spaces, remove extra spaces, and strip leading/trailing spaces
        sanitized_value = " ".join(value.split())
        return sanitized_value
    return value

def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [sanitize_string_input(col) for col in df.columns]

    # Sanitize cell values
    for col in df.columns:
        if df[col].dtype == 'object':  # Apply sanitization only to string columns
            df[col] = df[col].apply(sanitize_string_input)
    
    return df

def sanitize_table_name_sql(filename):
    """Sanitize the filename to be a valid SQL table name"""
    # Remove file extension
    name = os.path.splitext(filename)[0]
    # Replace invalid characters with underscores
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    # Ensure it starts with a letter
    if not name[0].isalpha():
        name = 'tbl_' + name
    return name