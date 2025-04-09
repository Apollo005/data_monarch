import React from "react";

const DataTable = ({ data }) => {
  if (!data || data.length === 0) return <p>No data available to display.</p>;

  const keys = Object.keys(data[0]);
  const displayData = data.slice(0, 5); // Only show first 5 rows
  const totalRows = data.length;

  return (
    <div style={{
      width: '100%',
      marginTop: '1rem'
    }}>
      {/* Row count display */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '0.5rem'
      }}>
        <div style={{
          backgroundColor: 'var(--primary-color)',
          color: 'var(--white)',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          Total Rows: {totalRows}
        </div>
      </div>

      <div style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'var(--white)',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        border: '1px solid var(--border-color)'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem'
        }}>
          <thead>
            <tr style={{
              backgroundColor: 'var(--white)'
            }}>
              {keys.map((key) => (
                <th 
                  key={key}
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: 'var(--text-dark)',
                    fontWeight: '600',
                    borderBottom: '2px solid var(--border-color)',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    ':hover': {
                      backgroundColor: 'var(--primary-color-light)',
                      color: 'var(--primary-color)'
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-color-light)';
                    e.currentTarget.style.color = 'var(--primary-color)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--white)';
                    e.currentTarget.style.color = 'var(--text-dark)';
                  }}
                >
                  {key}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: 'var(--border-color)'
                  }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, index) => (
              <tr 
                key={index}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  transition: 'background-color 0.2s ease',
                  cursor: 'pointer',
                  ':hover': {
                    backgroundColor: 'var(--background-light)'
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--background-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--white)';
                }}
              >
                {keys.map((key) => (
                  <td 
                    key={key}
                    style={{
                      padding: '1rem',
                      color: 'var(--text-dark)',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {row[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;