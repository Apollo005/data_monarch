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

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    
    if file.filename.endswith('.csv', '.xlsx') :
        try:
            content = await file.read()
            #check if the file is a csv data file
            if file.filename.endswith('.csv') :
                df = pd.read_csv(io.StringIO(content.decode("utf-8")))
            #check if the file is a excel data file
            elif file.filename.endswith('.xlsx') :
                df = pd.read_excel(io.StringIO(content.decode("utf-8")))
            #add json data upload functionality soon...

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing {file.filename}: {str(e)}")
    
    # return {"message": "File received"}
    return JSONResponse({"message": "File processed", "data": df.to_dict()})
