import pandas as pd

def check_if_table_exists(cursor, table_name: str) -> bool:
    cursor.execute(f"""
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = '{table_name}'
    );
    """)
    return cursor.fetchone()[0]

def create_table_from_df(df, table_name, cursor):
    #reset index and add a primary key column if desired:
    df.reset_index(drop=True, inplace=True)
    df.insert(0, 'Index', range(1, len(df) + 1))
    
    #start building column definitions (you can exclude the index if not needed)
    col_defs = ['"Index" serial primary key']
    for col in df.columns:
        if col != 'Index':  # Skip the auto-index column, add bool
            if pd.api.types.is_integer_dtype(df[col]) and df[col].notnull().all():
                col_type = 'integer'
                print(col_type)
            elif pd.api.types.is_float_dtype(df[col]) and df[col].notnull().all():
                col_type = 'double precision'
                print(col_type)
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                col_type = 'timestamp without time zone'
                print(col_type)
            elif pd.api.types.is_object_dtype(df[col]):
                col_type = 'text'
                print(col_type)
            else:
                col_type = 'text'
                print(col_type, "2")
            col_defs.append(f'"{col}" {col_type}')
    
    create_table_query = f"""
    DROP TABLE IF EXISTS {table_name};
    CREATE TABLE {table_name} (
        {', '.join(col_defs)}
    );
    """
    cursor.execute(create_table_query)