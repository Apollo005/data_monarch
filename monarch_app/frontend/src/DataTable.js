import React, { useState, useEffect } from "react";

const DataTable = ({ data, fileId, onPageChange }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsPosition, setStatsPosition] = useState({ x: 0, y: 0 });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [paginatedData, setPaginatedData] = useState(null);
  
  // Add more robust null checks
  const keys = data && Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
  const totalRowsFromData = data && Array.isArray(data) ? data.length : 0;

  // Fetch paginated data when fileId, currentPage, or pageSize changes
  useEffect(() => {
    if (fileId) {
      fetchPaginatedData();
    } else if (data) {
      // If no fileId is provided, use the data prop directly with client-side pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = data.slice(startIndex, endIndex);
      setPaginatedData(paginatedData);
      setTotalRows(data.length);
      setTotalPages(Math.ceil(data.length / pageSize));
    }
  }, [fileId, currentPage, pageSize, data]);

  const fetchPaginatedData = async () => {
    if (!fileId) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/data/${fileId}/paginated?page=${currentPage}&page_size=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch paginated data');
      }
      
      const result = await response.json();
      setPaginatedData(result.data);
      setTotalRows(result.pagination.total_records);
      setTotalPages(result.pagination.total_pages);
      
      // Notify parent component about page change if callback provided
      if (onPageChange) {
        onPageChange(currentPage, result.pagination.total_pages);
      }
    } catch (error) {
      console.error('Error fetching paginated data:', error);
      // Fallback to using the data prop if pagination fails
      if (data) {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = data.slice(startIndex, endIndex);
        setPaginatedData(paginatedData);
        setTotalRows(data.length);
        setTotalPages(Math.ceil(data.length / pageSize));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics for a column using only visible/paginated data
  const calculateStats = (column) => {
    if (!paginatedData || !Array.isArray(paginatedData) || paginatedData.length === 0) return null;
    
    const values = paginatedData.map(row => row[column]);
    const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
    
    if (numericValues.length === 0) {
      // For non-numeric columns, calculate mode only from current page
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
        median: 'N/A',
        note: '* Statistics shown are for current page only'
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
      mode: typeof mode === 'number' ? mode.toFixed(2) : mode,
      median: median.toFixed(2),
      note: '* Statistics shown are for current page only'
    };
  };

  // Debounce the column hover handler
  const handleColumnHover = React.useCallback((e, column) => {
    if (!showStats) return;
    setStats(calculateStats(column));
  }, [showStats, paginatedData]);

  // Handle column hover out
  const handleColumnHoverOut = () => {
    if (!showStats) return;
    setStats(null);
  };

  // Filter data based on search query
  const filteredData = paginatedData && Array.isArray(paginatedData) ? paginatedData.filter(row => {
    if (!searchQuery) return true;
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }) : [];

  // Early return with a more informative message
  if ((!data && !paginatedData) || (!Array.isArray(data) && !Array.isArray(paginatedData)) || (data && Array.isArray(data) && data.length === 0 && (!paginatedData || !Array.isArray(paginatedData) || paginatedData.length === 0))) {
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

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (e) => {
    const newPageSize = parseInt(e.target.value);
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate start and end of visible pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're near the beginning
      if (currentPage <= 2) {
        endPage = 4;
      }
      
      // Adjust if we're near the end
      if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }
      
      // Add ellipsis if needed
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

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
          {stats.note && (
            <div style={{
              marginTop: '1rem',
              fontSize: '0.75rem',
              color: 'var(--text-light)',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              {stats.note}
            </div>
          )}
        </div>
      )}

      <div style={{
        width: '100%',
        maxHeight: '300px',
        overflow: 'auto',
        backgroundColor: 'var(--white)',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--border-color)',
        position: 'relative'
      }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10
          }}>
            <div className="loading-spinner"></div>
          </div>
        )}
        <div style={{
          width: '100%',
          overflowX: 'auto',
          position: 'relative'
        }}>
          <table style={{
            width: '100%',
            minWidth: 'max-content',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
            tableLayout: 'fixed'
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
                      minWidth: '150px',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer'
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
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
                    e.currentTarget.style.color = 'var(--white)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--white)';
                    e.currentTarget.style.color = 'var(--text-dark)';
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
                        minWidth: '150px',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          padding: '0.5rem 0',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ color: 'var(--text-dark)', fontSize: '0.875rem' }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--white)',
                color: 'var(--text-dark)',
                fontSize: '0.875rem'
              }}
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: currentPage === 1 ? 'var(--background-light)' : 'var(--white)',
                color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-dark)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <i className="fas fa-angle-double-left"></i>
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: currentPage === 1 ? 'var(--background-light)' : 'var(--white)',
                color: currentPage === 1 ? 'var(--text-light)' : 'var(--text-dark)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <i className="fas fa-angle-left"></i>
            </button>
            
            <div style={{
              display: 'flex',
              gap: '0.25rem'
            }}>
              {getPageNumbers().map((pageNum, index) => (
                pageNum === '...' ? (
                  <span 
                    key={`ellipsis-${index}`}
                    style={{
                      padding: '0.25rem 0.5rem',
                      color: 'var(--text-dark)',
                      fontSize: '0.875rem'
                    }}
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(pageNum)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: currentPage === pageNum ? 'var(--primary-color)' : 'var(--white)',
                      color: currentPage === pageNum ? 'var(--white)' : 'var(--text-dark)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      minWidth: '2rem',
                      textAlign: 'center'
                    }}
                  >
                    {pageNum}
                  </button>
                )
              ))}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: currentPage === totalPages ? 'var(--background-light)' : 'var(--white)',
                color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-dark)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <i className="fas fa-angle-right"></i>
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: currentPage === totalPages ? 'var(--background-light)' : 'var(--white)',
                color: currentPage === totalPages ? 'var(--text-light)' : 'var(--text-dark)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <i className="fas fa-angle-double-right"></i>
            </button>
          </div>
          
          <div style={{
            color: 'var(--text-dark)',
            fontSize: '0.875rem'
          }}>
            {`${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalRows)} of ${totalRows}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;