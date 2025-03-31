import React from "react";

const DataTable = ({ data }) => {
  if (!data || data.length === 0) return <p>No data available to display.</p>;

  const keys = Object.keys(data[0]);

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {keys.map((key) => (
                <td key={key}>{row[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;