import pandas as pd
import io

def clean_header_csv(content, delimiter=","):
    lines = content.split("\n")
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