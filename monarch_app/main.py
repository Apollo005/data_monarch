import pandas as pd
import numpy as np
import datetime as dt
import pdfplumber
import matplotlib.pyplot as plt
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import Union
import io
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from codes.filter import filter_data

app = FastAPI()

#overall data frame to store uploaded data into
data_frame = pd.DataFrame()

#work with this later to figure out file size checks
FILE_SIZE_THRESHOLD = 10 * 1024 * 1024

#enable CORS to allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  #react frontend URL
    allow_credentials=True,
    allow_methods=["*"],  #allow all HTTP methods
    allow_headers=["*"],  #allow all headers
)

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

#mainly for text files
def remove_text_after_char(df, char) :
    df = df.map(lambda x: x.split(char, 1)[0] if isinstance(x, str) and char in x else x)
    return df

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    
    if file.filename.endswith(('.csv', '.xlsx', '.json', '.pdf', '.txt', '.jsonl')) :
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
            
            #ad jsonl file upload functionality
            elif file.filename.endswith('.jsonl') :
                content_str = content_bytes.decode("utf-8")
                df = pd.read_json(content_str, convert_dates=True, lines=True)
                
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

                if df is None:
                    lines = content_str.split("\n")

                    #remove empty lines and comments
                    lines = [line.split("#", 1)[0].strip() for line in lines if line.strip()]

                    #convert space-separated values into a structured DataFrame
                    data = [line.split() for line in lines if len(line.split()) > 1]

                    #make this user input afterwards and check for column-data imbalance
                    #default error message is "error processing solar_flux.txt: 7 columns passed, passed data had 5 columns"
                    column_names = ["Year", "HH:mm", " value ", "qualifier", "description"]
                    df = pd.DataFrame(data, columns=column_names)

                df = df.apply(pd.to_numeric, errors='ignore')
                df = df.dropna().reset_index(drop=True)

            df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
            df = df.replace({pd.NaT: None})
            #convert to records (list of dicts)
            records = df.to_dict('records')
            #store dataframe:
            data_frame = df
            
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

#next part of the pipeline to implement a websocket for real time changes to the data:
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Listen for messages (e.g., filter parameters) from the frontend
            message = await websocket.receive_text()
            
            # Here you would filter data based on the message received (e.g., filter params)
            # You can also send updates when new data is processed
            # filtered_data = filter_data_logic(message)  # Implement your filtering logic
            # await websocket.send_text(str(filtered_data))  # Send filtered data back to the client
    except WebSocketDisconnect:
        print("Client disconnected")