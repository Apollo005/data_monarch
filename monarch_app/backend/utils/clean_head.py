import pandas as pd
import io

def clean_header_csv(content, delimiter=","):
    lines = content.split("\n")
    if not lines:
        return 0
        
    # First, find the maximum number of columns in any row
    max_cols = 0
    for line in lines:
        cols = [col.strip() for col in line.split(delimiter) if col.strip()]
        max_cols = max(max_cols, len(cols))
    
    if max_cols < 2:
        return 0
        
    # Look for the first row that has a consistent structure with subsequent rows
    for i in range(len(lines) - 1):  # -1 to ensure we have at least one row after
        current_row = [col.strip() for col in lines[i].split(delimiter) if col.strip()]
        next_row = [col.strip() for col in lines[i + 1].split(delimiter) if col.strip()]
        
        # Skip empty rows
        if not current_row or not next_row:
            continue
            
        # Check if this row has a similar structure to the next row
        # This helps identify where the actual data starts
        if len(current_row) >= max_cols * 0.8:  # Allow some flexibility in column count
            # Additional check: if the next row contains mostly numeric values,
            # it's likely the start of actual data
            numeric_count = sum(1 for val in next_row if val.replace('.', '').replace('-', '').isdigit())
            if numeric_count >= len(next_row) * 0.5:  # If more than 50% are numeric
                return i
                
    # If we couldn't find a clear data start point, return the first non-empty row
    for i, line in enumerate(lines):
        cols = [col.strip() for col in line.split(delimiter) if col.strip()]
        if len(cols) >= 2:
            return i
            
    return 0

def clean_header_xlsx(content):
    #assuming no headers and every row is captured
    df = pd.read_excel(io.BytesIO(content), header=None)
    max_cols = max(df.apply(lambda row: row.dropna().shape[0], axis=1))

    for i in range(len(df)):
        row = df.iloc[i].dropna().astype(str).str.strip()

        if len(row) == max_cols:
            return i
        
    return 0