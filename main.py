import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import Union
import io
from fastapi.responses import JSONResponse, FileResponse

app = FastAPI()

#testing the app

@app.get("/")
def read_root():
    return {"Hello": "World"}

# @app.get("/items/{item_id}")
# def read_item(item_id: int, q: str):
#     return {"item_id": item_id, "q": q}

def clean_header_csv(content):
    lines = content.split("\n")
    for i, line in enumerate(lines):
        cols = line.split(",")
        if len(cols) > 1 and all(len(col.strip()) > 0 for col in cols):
            return i
    return 0

# example of the skip header functionality:
# file_path = "/Users/adity1/Desktop/Climate 323/Lab01/CSRB_20040716.csv"
# with open(file_path, "r") as f:
#     content = f.read()
# skip_rows = clean_header_csv(content)
# print(skip_rows)

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    
    if file.filename.endswith(('.csv', '.xlsx')) :
        try:
            content_bytes = await file.read()
            content_str = content_bytes.decode("utf-8")
            #check if the file is a csv data file
            #try to work with weirdly formatted data: "skip headers"...
            if file.filename.endswith('.csv') :
                #if there are extra rows that need to be skipped this will do that
                skip_rows = clean_header_csv(content_str)
                df = pd.read_csv(io.StringIO(content_str), skiprows=skip_rows)
                print('csv')
            #check if the file is a excel data file
            elif file.filename.endswith('.xlsx') :
                df = pd.read_excel(io.BytesIO(content_bytes))
                print('xlsx')
            #add json data upload functionality soon...
                
            df = df.replace({np.nan: None, np.inf: None, -np.inf: None})

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing {file.filename}: {str(e)}")
    else :
        raise HTTPException(status_code=415, detail=f"Unsupported file type for {file.filename}")
    # return {"message": "File received"}
    return JSONResponse({"message": "File processed", "data": df.to_dict()})
