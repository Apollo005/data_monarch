import pandas as pd
import numpy as np
import datetime as dt
import pdfplumber
import matplotlib.pyplot as plt
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import Union
import io
from fastapi.responses import JSONResponse, FileResponse

app = FastAPI()
print("hi")
#testing the app

@app.get("/")
def read_root():
    return {"Hello": "World"}

# @app.get("/items/{item_id}")
# def read_item(item_id: int, q: str):
#     return {"item_id": item_id, "q": q}

#drawback of cleaning functions is it only checks for the first row that has the same # of cols as the max number of cols in the dataset

def clean_header_csv(content):
    lines = content.split("\n")
    for i, line in enumerate(lines):
        cols = line.split(",")
        if len(cols) > 1 and all(len(col.strip()) > 0 for col in cols):
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

def extract_table_from_txt(content):
    lines = content.split("\n")

    table_lines = [line.strip() for line in lines if "|" in line and any(char.isdigit() for char in line)]

    if not table_lines:
        return None

    columns = [col.strip() for col in table_lines[0].split("|") if col.strip()]

    data = []
    for line in table_lines[1:]:
        values = [val.strip() for val in line.split("|") if val.strip()]
        if len(values) == len(columns):
            data.append(values)

    df = pd.DataFrame(data, columns=columns)
    return df


# example of the skip header functionality:
# file_path = "/Users/adity1/Desktop/Climate 323/Lab01/CSRB_20040716.csv"
# with open(file_path, "r") as f:
#     content = f.read()
# skip_rows = clean_header_csv(content)
# print(skip_rows)

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    
    if file.filename.endswith(('.csv', '.xlsx', '.json', '.pdf', '.txt')) :
        try:
            content_bytes = await file.read()

            #check if the file is a csv data file
            if file.filename.endswith('.csv') :
                content_str = content_bytes.decode("utf-8")
                #if there are extra rows that need to be skipped this will do that
                skip_rows = clean_header_csv(content_str)
                df = pd.read_csv(io.StringIO(content_str), skiprows=skip_rows, parse_dates=True)
                print('csv')

            #check if the file is a excel data file
            elif file.filename.endswith('.xlsx') :
                skip_rows = clean_header_xlsx(content_bytes)
                df = pd.read_excel(io.BytesIO(content_bytes), skiprows=skip_rows, parse_dates=True)
                print('xlsx')

            #add json data upload functionality - don't need to check for extra header info
            elif file.filename.endswith('.json') :
                content_str = content_bytes.decode("utf-8")
                df = pd.read_json(content_str, convert_dates=True)

            #.pdf data extraction needs more work ########
            elif file.filename.endswith('.pdf') :
                with pdfplumber.open(io.BytesIO(content_bytes)) as pdf :
                    all_data = []
                    for page in pdf.pages:

                        tables = page.extract_tables()
                        
                        #if no tables found or empty tables, try other settings
                        if not tables or all(len(table) == 0 for table in tables):
                            tables = page.extract_tables({
                                "vertical_strategy": "text", 
                                "horizontal_strategy": "text",
                                "snap_tolerance": 5,
                                "join_tolerance": 3
                            })
                                                
                        for table in tables:

                            if table and len(table) > 0:
                                print(f"Sample row: {table[0]}")
                            all_data.extend(table)
                # Only proceed if we have data
                if all_data and len(all_data) > 0:
                    df = pd.DataFrame(all_data)
                    
                    #set first row as column headers only if it contains non-empty values
                    if df.shape[0] > 0 and not df.iloc[0].isna().all():
                        header = df.iloc[0]
                        df.columns = [str(col) if col else f"Column_{i}" for i, col in enumerate(header)]
                        df = df[1:].reset_index(drop=True)
                        
                        #remove any rows that match the header row (removes repeated headers)
                        df = df[~df.apply(lambda row: row.tolist() == header.tolist(), axis=1)]
                else:
                    #if no table data was extracted, try extracting text by page instead
                    print("No table data found, extracting text")
                    text_data = []
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            lines = text.split('\n')
                            text_data.extend([[line] for line in lines if line.strip()])
                    
                    df = pd.DataFrame(text_data)
            #.txt data extraction needs more work ###########
            elif file.filename.endswith('.txt') :
                content_str = content_bytes.decode("utf-8")
                df = extract_table_from_txt(content_str)

                if df is None or df.empty:
                    raise HTTPException(status_code=400, detail="No valid tables found in TXT file.")

            df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
            
            #convert to records (list of dicts)
            records = df.replace({pd.NaT: None}).to_dict('records')
            
            #process each record to ensure all values are JSON serializable
            for record in records:
                for key, value in record.items():
                    if isinstance(value, pd.Timestamp):
                        record[key] = value.strftime('%Y-%m-%d')
                    elif pd.isna(value):
                        record[key] = None
            
            return JSONResponse({"message": "File processed", "data": records})

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing {file.filename}: {str(e)}")
    else :
        raise HTTPException(status_code=415, detail=f"Unsupported file type for {file.filename}")
    # return {"message": "File received"}
