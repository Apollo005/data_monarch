import pandas as pd

#need to add functionality for filtering by column values {string, num}, null values, duplicate values, thresholded values
#should add def for functions of all types of filtering defined above
def filter_data(df: pd.DataFrame) -> pd.DataFrame :
    print(df.head())