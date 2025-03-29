import pandas as pd

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