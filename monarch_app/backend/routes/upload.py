from utils.imports import *
from database.tables import User
from routes.auth import get_current_user
from database.files import engine
from utils.clean_head import clean_header_csv, clean_header_xlsx
from utils.sanitize import sanitize_table_name, sanitize_dataframe
from utils.db_helpers import check_if_table_exists, create_table_from_df
from utils.text_extract import extract_table_from_txt


router = APIRouter()

@router.post("/api/data/upload/")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    
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
            
            df = sanitize_dataframe(df)

            #convert to records (list of dicts)
            records = df.to_dict('records')
            
            #process each record to ensure all values are JSON serializable
            for record in records:
                for key, value in record.items():
                    if isinstance(value, pd.Timestamp):
                        record[key] = value.strftime('%Y-%m-%d')
                    elif pd.isna(value):
                        record[key] = None

            #create table based on df
            base_table_name = sanitize_table_name(file.filename.rsplit('.', 1)[0])
            base_table_name = base_table_name.lower()
            table_name = base_table_name.lower()

            connection = engine.raw_connection()
            cursor = connection.cursor()

            suffix_counter = 1
            while check_if_table_exists(cursor, table_name):
                table_name = f"{base_table_name}_{suffix_counter}"
                suffix_counter += 1

            create_table_from_df(df, table_name, cursor)
            connection.commit()

            #stream data into PostgreSQL using COPY
            output = io.StringIO()
            df.to_csv(output, sep='\t', header=False, index=False)
            output.seek(0)

            #copy_from to bulk load data
            cursor.copy_from(output, table_name, null="")    
            connection.commit()
            cursor.close()
            connection.close()

            return JSONResponse({"message": "File processed", "data": records})

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing {file.filename}: {str(e)}")
    else :
        raise HTTPException(status_code=415, detail=f"Unsupported file type for {file.filename}")