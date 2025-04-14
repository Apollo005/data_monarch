import React, { useState } from "react";

const DataTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsPosition, setStatsPosition] = useState({ x: 0, y: 0 });
  
  // Add more robust null checks
  const keys = data && Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
  const totalRows = data && Array.isArray(data) ? data.length : 0;

  // Calculate statistics for a column
  const calculateStats = (column) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    
    const values = data.map(row => row[column]);
    const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
    
    if (numericValues.length === 0) {
      // For non-numeric columns, calculate mode only
      const frequency = {};
      values.forEach(v => {
        frequency[v] = (frequency[v] || 0) + 1;
      });
      const mode = Object.entries(frequency).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      
      return {
        min: 'N/A',
        max: 'N/A',
        average: 'N/A',
        range: 'N/A',
        mode: mode,
        median: 'N/A'
      };
    }

    // For numeric columns
    const sorted = [...numericValues].sort((a, b) => a - b);
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const average = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
      : sorted[Math.floor(sorted.length/2)];
    
    // Calculate mode
    const frequency = {};
    numericValues.forEach(v => {
      frequency[v] = (frequency[v] || 0) + 1;
    });
    const mode = Object.entries(frequency).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    return {
      min: min.toFixed(2),
      max: max.toFixed(2),
      average: average.toFixed(2),
      range: (max - min).toFixed(2),
      mode: typeof mode[0] === 'number' ? mode[0].toFixed(2) : mode[0],
      median: median.toFixed(2)
    };
  };

  // Handle column hover for statistics
  const handleColumnHover = (e, column) => {
    if (!showStats) return;
    setStats(calculateStats(column));
  };

  // Handle column hover out
  const handleColumnHoverOut = () => {
    if (!showStats) return;
    setStats(null);
  };

  // Filter data based on search query
  const filteredData = data && Array.isArray(data) ? data.filter(row => {
    if (!searchQuery) return true;
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }) : [];

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
    if (!sortConfig.key || !sortConfig.direction) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle numeric values (including decimals)
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' 
          ? aNum - bNum
          : bNum - aNum;
      }

      // Handle datetime values
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortConfig.direction === 'asc' 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
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
      {/* Search bar and row count display */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        gap: '1rem'
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            position: 'relative',
            flex: 1
          }}>
            <input
              type="text"
              placeholder="Search in table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '30%',
                padding: '0.75rem 1rem',
                paddingLeft: '2.5rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--white)',
                color: 'var(--text-dark)',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}
            />
            <i className="fas fa-search" style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-light)',
              fontSize: '0.875rem'
            }}></i>
          </div>
          {searchQuery && (
            <div style={{
              backgroundColor: 'var(--primary-color)',
              color: 'var(--white)',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: '500',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              whiteSpace: 'nowrap'
            }}>
              {filteredData.length} results
            </div>
          )}
          <button
            onClick={() => setShowStats(!showStats)}
            style={{
              backgroundColor: showStats ? 'var(--primary-color)' : 'var(--white)',
              color: showStats ? 'var(--white)' : 'var(--text-dark)',
              border: '1px solid var(--border-color)',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <i className={`fas fa-${showStats ? 'chart-bar' : 'chart-line'}`}></i>
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
        </div>
        <div style={{
          backgroundColor: 'var(--primary-color)',
          color: 'var(--white)',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          whiteSpace: 'nowrap'
        }}>
          Total Rows: {totalRows}
        </div>
      </div>

      {/* Statistics Popup */}
      {stats && showStats && (
        <div style={{
          position: 'fixed',
          left: '50%',
          top: '10%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--white)',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          minWidth: '300px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ fontWeight: '500', color: 'var(--text-dark)', textAlign: 'center' }}>Min</div>
            <div style={{ fontWeight: '500', color: 'var(--text-dark)', textAlign: 'center' }}>Average</div>
            <div style={{ fontWeight: '500', color: 'var(--text-dark)', textAlign: 'center' }}>Max</div>
            <div style={{ color: 'var(--text-dark)', textAlign: 'center' }}>{stats.min}</div>
            <div style={{ color: 'var(--text-dark)', textAlign: 'center' }}>{stats.average}</div>
            <div style={{ color: 'var(--text-dark)', textAlign: 'center' }}>{stats.max}</div>
            <div style={{ fontWeight: '500', color: 'var(--text-dark)', textAlign: 'center' }}>Range</div>
            <div style={{ fontWeight: '500', color: 'var(--text-dark)', textAlign: 'center' }}>Mode</div>
            <div style={{ fontWeight: '500', color: 'var(--text-dark)', textAlign: 'center' }}>Median</div>
            <div style={{ color: 'var(--text-dark)', textAlign: 'center' }}>{stats.range}</div>
            <div style={{ color: 'var(--text-dark)', textAlign: 'center' }}>{stats.mode}</div>
            <div style={{ color: 'var(--text-dark)', textAlign: 'center' }}>{stats.median}</div>
          </div>
        </div>
      )}

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
                  onMouseEnter={(e) => handleColumnHover(e, key)}
                  onMouseLeave={handleColumnHoverOut}
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
                >
                  {key}
                  {sortConfig.key === key && (
                    <span style={{ marginLeft: '5px' }}>
                      {sortConfig.direction === 'asc' ? '↑' : sortConfig.direction === 'desc' ? '↓' : ''}
                    </span>
                  )}
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
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
                  e.currentTarget.style.color = 'var(--white)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--white)';
                  e.currentTarget.style.color = 'var(--text-dark)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {keys.map((key) => (
                  <td 
                    key={key}
                    onMouseEnter={(e) => handleColumnHover(e, key)}
                    onMouseLeave={handleColumnHoverOut}
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
                      transition: 'all 0.2s ease',
                      cursor: showStats ? 'pointer' : 'default'
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