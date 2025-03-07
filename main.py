import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from fastapi import FastAPI, UploadFile, File, Form
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
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    
    # return {"message": "File received"}
    return JSONResponse({"message": "File processed", "data": df.to_dict()})
