import React, { useState } from "react";

const DataTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  
  // Add more robust null checks
  const keys = data && Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
  const totalRows = data && Array.isArray(data) ? data.length : 0;

  // Early return with a more informative message
  if (!data || !Array.isArray(data) || data.length === 0) {
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
            Total Rows: 0
          </div>
        </div>

        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-light)',
          backgroundColor: 'var(--background-light)',
          borderRadius: '8px'
        }}>
          No data available to display.
        </div>
      </div>
    );
  }

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = () => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle datetime values
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortConfig.direction === 'asc' 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // Handle numeric values (including decimals)
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' 
          ? aNum - bNum
          : bNum - aNum;
      }

      // Handle string values
      const aString = String(aValue || '').toLowerCase();
      const bString = String(bValue || '').toLowerCase();
      
      return sortConfig.direction === 'asc'
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString);
    });
  };

  const sortedData = getSortedData();

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
        maxHeight: '300px',
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
          <thead style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--white)',
            zIndex: 1
          }}>
            <tr>
              {keys.map((key) => (
                <th 
                  key={key}
                  onClick={() => handleSort(key)}
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
                  {sortConfig.key === key && (
                    <span style={{ marginLeft: '5px' }}>
                      {sortConfig.direction === 'asc' ? '↑' : sortConfig.direction === 'desc' ? '↓' : ''}
                    </span>
                  )}
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
            {sortedData.map((row, index) => (
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
                      color: sortConfig.key === key 
                        ? sortConfig.direction === 'asc' 
                          ? '#e74c3c'  // Red for ascending
                          : sortConfig.direction === 'desc'
                            ? '#2ecc71'  // Green for descending
                            : 'var(--text-dark)'
                        : 'var(--text-dark)',
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