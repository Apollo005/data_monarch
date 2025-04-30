import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from './FileUpload';
import Sidebar from './SideBar';
import ThemeToggle from './components/ThemeToggle';
import DataTable from './DataTable';
import DataVisualization from './components/DataVisualization';
import DataAnalysis from './components/DataAnalysis';
import config from './config';
import './styles/global.css';
import 'font-awesome/css/font-awesome.min.css';
import axios from 'axios';

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [originalData, setOriginalData] = useState(null);
  const [uploadedData, setUploadedData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(null);
  const [sortConfig, setSortConfig] = useState({ column: null, direction: null, clicks: 0 });
  const [filterQuery, setFilterQuery] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [dataHistory, setDataHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [showOriginalDataPopup, setShowOriginalDataPopup] = useState(false);
  const [historyDescriptions, setHistoryDescriptions] = useState([]);
  const [versionToDelete, setVersionToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [versionNumbers, setVersionNumbers] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showSummarizeDropdown, setShowSummarizeDropdown] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [workspaceToDelete, setWorkspaceToDelete] = useState(null);
  const [showDeleteWorkspaceConfirm, setShowDeleteWorkspaceConfirm] = useState(false);
  const [showManageWorkspaces, setShowManageWorkspaces] = useState(false);
  const [isRenaming, setIsRenaming] = useState(null);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev => {
      const newVisible = { ...prev };
      newVisible[column] = !newVisible[column];
      return newVisible;
    });
  };

  const handleColumnSort = (column) => {
    // Check if the column contains numerical data
    const isNumerical = uploadedData.every(row => !isNaN(row[column]));
    const isValidDate = uploadedData.every(row => {
      const dateTest = new Date(row[column]);
      return !isNaN(dateTest.valueOf());
    });
    
    if (!isNumerical && !isValidDate) return; // Only sort numerical columns

    setSortConfig(prevConfig => {
      let newDirection = 'desc';
      let newClicks = 1;

      if (prevConfig.column === column) {
        if (prevConfig.clicks === 1) {
          newDirection = 'asc';
          newClicks = 2;
        } else if (prevConfig.clicks === 2) {
          newDirection = null;
          newClicks = 3;
        }
      }

      // Sort the data
      if (newDirection) {
        const sortedData = [...uploadedData].sort((a, b) => {
          let aVal, bVal;
          if (isNumerical) {
              aVal = parseFloat(a[column]);
              bVal = parseFloat(b[column]);
          }else if (isValidDate){
              aVal = new Date(a[column]).valueOf();
              bVal = new Date(b[column]).valueOf();
          }
            
          return newDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });
        setUploadedData(sortedData);
      } else {
        setUploadedData(originalData);// Reset to original order
      }

      return {
        column,
        direction: newDirection,
        clicks: newClicks
      };
    });
  };

  const handleFileSelect = async (file) => {
    // If file is null, it means we want a new upload instance
    if (file === null) {
      setSelectedFile(null);
      setUploadedData(null);
      setActiveTab('upload');
      // Reset history when clearing file
      setDataHistory([]);
      setCurrentHistoryIndex(-1);
      setHistoryDescriptions([]);
      setVersionNumbers([]);
      return;
    }

    setSelectedFile(file);
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");

      // First fetch the initial file data
      const initialResponse = await fetch(`${config.baseUrl}/api/data/${file.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!initialResponse.ok) {
        throw new Error('Failed to fetch initial file data');
      }

      const initialData = await initialResponse.json();

      // Then fetch the file data and version history
      const historyResponse = await fetch(`${config.baseUrl}/api/data/history/${file.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!historyResponse.ok) {
        throw new Error('Failed to fetch file data and history');
      }

      const history = await historyResponse.json();

      if (history && history.length > 0) {
        // Check if the first history item is already an initial upload
        const isFirstHistoryInitial = history[0].description === 'Initial data upload';
        
        // Combine initial data with history, avoiding duplicates
        const combinedHistory = isFirstHistoryInitial 
          ? history.map(h => ({ ...h, version: h.version }))
          : [
              { data: initialData.data, description: 'Initial data upload', is_current: false, version: 1 },
              ...history.map(h => ({ ...h, version: h.version }))
            ];
        
        // Set the data history based on combined versions
        setDataHistory(combinedHistory.map(h => h.data));
        setCurrentHistoryIndex(combinedHistory.findIndex(h => h.is_current) || 0);
        setHistoryDescriptions(combinedHistory.map(h => h.description || ''));
        setVersionNumbers(combinedHistory.map(h => h.version));
        
        // Set the current data (most recent version)
        const currentVersionIndex = combinedHistory.findIndex(h => h.is_current) || 0;
        setUploadedData(combinedHistory[currentVersionIndex].data);
        setFilterDescription(combinedHistory[currentVersionIndex].description || '');

        // Initialize visible columns when file is selected
        const initialVisible = {};
        Object.keys(combinedHistory[0].data[0] || {}).forEach(column => {
          initialVisible[column] = true;
        });
        setVisibleColumns(initialVisible);
      } else {
        // If no history exists, use just the initial data
        setDataHistory([initialData.data]);
        setCurrentHistoryIndex(0);
        setHistoryDescriptions(['Initial data upload']);
        setVersionNumbers([1]);
        setUploadedData(initialData.data);
        setFilterDescription('Initial data upload');

        // Initialize visible columns
        const initialVisible = {};
        Object.keys(initialData.data[0] || {}).forEach(column => {
          initialVisible[column] = true;
        });
        setVisibleColumns(initialVisible);
      }

      setActiveTab('upload');

    } catch (error) {
      console.error('Error loading file:', error);
      setError('Failed to load file data and history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'upload', label: 'Upload Data', icon: 'fa-upload' },
    { id: 'filter', label: 'Filter Data', icon: 'fa-filter' },
    { id: 'analyze', label: 'Analyze Data', icon: 'fa-chart-bar' },
    { id: 'visualize', label: 'Visualize', icon: 'fa-chart-line' },
    { id: 'export', label: 'Export Data', icon: 'fa-file-export' }
  ];

  const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab);

  const handleNext = () => {
    if (currentTabIndex < tabs.length - 1) {
      setActiveTab(tabs[currentTabIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentTabIndex > 0) {
      setActiveTab(tabs[currentTabIndex - 1].id);
    }
  };

  const handleDataUpload = (data) => {
    setUploadedData(data);
    setOriginalData(data); // Also set original data
    // Initialize history with uploaded data
    setDataHistory([data]);
    setCurrentHistoryIndex(0);
    setHistoryDescriptions(['Initial data upload']);
    setVersionNumbers([1]);
    // Initialize visible columns when data is uploaded
    const initialVisible = {};
    Object.keys(data[0] || {}).forEach(column => {
      initialVisible[column] = true;
    });
    setVisibleColumns(initialVisible);
    // Reset filter-related state
    setFilterQuery('');
    setFilterDescription('');
    setIsFiltering(false);
  };

  const handleUndo = () => {
    if (currentHistoryIndex > 0 && dataHistory.length > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      setUploadedData(dataHistory[newIndex]);
      setFilterDescription(`Undid to previous state (${newIndex + 1}/${dataHistory.length})`);
    }
  };

  const handleRedo = () => {
    if (currentHistoryIndex < dataHistory.length - 1 && dataHistory.length > 0) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      setUploadedData(dataHistory[newIndex]);
      setFilterDescription(`Redid to next state (${newIndex + 1}/${dataHistory.length})`);
    }
  };

  const handleFilterSubmit = async () => {
    if (!uploadedData || !selectedFile) {
      setError('Please upload or select a file first');
      return;
    }

    setIsFiltering(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/data/filter`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: selectedFile.id,
          query: filterQuery
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to apply filter';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Add current state to history before updating
      const newHistory = dataHistory.slice(0, currentHistoryIndex + 1);
      newHistory.push(result.data);
      setDataHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);
      
      // Add description to history
      const newDescription = filterDescription || `Filter applied: ${filterQuery}`;
      setHistoryDescriptions(prev => [...prev.slice(0, currentHistoryIndex + 1), newDescription]);
      
      setUploadedData(result.data);
      setFilterDescription(result.description);
      setFilterQuery(''); // Clear the filter query after successful application
    } catch (error) {
      console.error('Error applying filter:', error);
      setError(error.message || 'An unexpected error occurred while applying the filter');
    } finally {
      setIsFiltering(false);
    }
  };

  const handleHistoryClick = (index) => {
    setCurrentHistoryIndex(index);
    setUploadedData(dataHistory[index]);
    setShowHistoryPopup(false);
  };

  const handleDeleteVersion = async (version) => {
    if (!selectedFile) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/data/history/${selectedFile.id}/${version}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete version');
      }
      
      // Refresh the file data to get updated history
      await handleFileSelect(selectedFile);
      
    } catch (error) {
      console.error('Error deleting version:', error);
      setError(error.message);
    }
  };

  const handleDeleteClick = (version) => {
    setVersionToDelete(version);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (versionToDelete) {
      handleDeleteVersion(versionToDelete);
    }
    setShowDeleteConfirm(false);
    setVersionToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setVersionToDelete(null);
  };

  const handleSidebarToggle = (collapsed) => {
    setIsSidebarCollapsed(collapsed);
  };

  // Add click handlers for dropdowns
  const handleAddClick = (event) => {
    event.stopPropagation();
    setShowAddDropdown(!showAddDropdown);
    setShowSummarizeDropdown(false);
  };

  const handleSummarizeClick = (event) => {
    event.stopPropagation();
    setShowSummarizeDropdown(!showSummarizeDropdown);
    setShowAddDropdown(false);
  };

  const handleWorkspaceClick = (event) => {
    event.stopPropagation();
    setShowWorkspaceDropdown(!showWorkspaceDropdown);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowAddDropdown(false);
        setShowSummarizeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showWorkspaceDropdown && !event.target.closest('.workspace-dropdown')) {
        setShowWorkspaceDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showWorkspaceDropdown]);

  // Add useEffect to fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await axios.get(`${config.baseUrl}/api/workspaces`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          withCredentials: true,
        });

        setWorkspaces(response.data);
        
        // Set default workspace if none is selected
        if (!currentWorkspace && response.data.length > 0) {
          const defaultWorkspace = response.data.find(w => w.is_default) || response.data[0];
          setCurrentWorkspace(defaultWorkspace);
        }
      } catch (err) {
        console.error("Error fetching workspaces:", err);
      }
    };

    fetchWorkspaces();
  }, []);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/workspaces`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: newWorkspaceName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create workspace");
      }

      const newWorkspace = await response.json();
      setWorkspaces([...workspaces, newWorkspace]);
      setNewWorkspaceName("");
      setShowCreateWorkspace(false);
      setCurrentWorkspace(newWorkspace);
      setSelectedFile(null);
      setUploadedData(null);
    } catch (error) {
      console.error("Error creating workspace:", error);
      setError("Failed to create workspace");
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/workspaces/${workspaceToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete workspace");
      }

      setWorkspaces(workspaces.filter(w => w.id !== workspaceToDelete.id));
      setWorkspaceToDelete(null);
      setShowDeleteWorkspaceConfirm(false);

      // Switch to default workspace if current workspace was deleted
      if (currentWorkspace.id === workspaceToDelete.id) {
        const defaultWorkspace = workspaces.find(w => w.is_default);
        if (defaultWorkspace) {
          setCurrentWorkspace(defaultWorkspace);
          setSelectedFile(null);
          setUploadedData(null);
        }
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
      setError("Failed to delete workspace");
    }
  };

  const handleRenameWorkspace = async (workspace) => {
    if (!newWorkspaceName.trim() || newWorkspaceName === workspace.name) {
      setIsRenaming(null);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: newWorkspaceName }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename workspace");
      }

      const updatedWorkspace = await response.json();
      setWorkspaces(workspaces.map(w => 
        w.id === workspace.id ? updatedWorkspace : w
      ));
      
      if (currentWorkspace.id === workspace.id) {
        setCurrentWorkspace(updatedWorkspace);
      }
      
      setIsRenaming(null);
      setNewWorkspaceName("");
    } catch (error) {
      console.error("Error renaming workspace:", error);
      setError("Failed to rename workspace");
    }
  };

  const renderDataTable = () => {
    if (!uploadedData) return null;

    const columns = Object.keys(uploadedData[0] || {});
    
    return (
      <div className="table-container" style={{ width: '100%', overflowX: 'auto' }}>
        {/* Fixed header row with toggleable column names */}
        <div className="table-header" style={{
          display: 'flex',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: 'var(--primary-color-light)',
          borderRadius: '8px 8px 0 0',
          borderBottom: '2px solid var(--border-color)',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {columns.map(column => (
            <div
              key={column}
              onClick={() => handleColumnToggle(column)}
              style={{
                cursor: 'pointer',
                padding: '0.5rem 1rem',
                backgroundColor: visibleColumns[column] ? 'var(--primary-color)' : 'var(--background-light)',
                color: visibleColumns[column] ? 'var(--white)' : 'var(--text-dark)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {column}
              <span>
                {visibleColumns[column] ? '●' : '○'}
              </span>
            </div>
          ))}
        </div>

        {/* Data table */}
        <DataTable 
          data={uploadedData} 
          fileId={selectedFile ? selectedFile.id : null}
          onPageChange={(page, totalPages) => {
            console.log(`Page ${page} of ${totalPages}`);
          }}
        />
      </div>
    );
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="tab-content-container">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px'
          }}>
            <div className="loading-spinner" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="tab-content-container">
          <div style={{
            color: 'var(--error)',
            padding: '1rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'upload':
        return (
          <div className="tab-content-container">
            <FileUpload 
              onDataUpload={handleDataUpload} 
              existingData={uploadedData} 
              currentWorkspace={currentWorkspace}
            />
          </div>
        );
      case 'filter':
        return (
          <div className="tab-content-container">
            {uploadedData ? (
              <div>
                <div className="tab-content-header">
                  <h2>Filter Data</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleUndo}
                      disabled={currentHistoryIndex <= 0}
                      className="tab-button secondary"
                      title="Undo"
                    >
                      <i className="fas fa-undo"></i>
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={currentHistoryIndex >= dataHistory.length - 1}
                      className="tab-button secondary"
                      title="Redo"
                    >
                      <i className="fas fa-redo"></i>
                    </button>
                  </div>
                </div>

                <div className="tab-section">
                  <div className="tab-form-group">
                    <textarea
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Enter your filter query (e.g., 'Remove rows with null values', 'Group by column X', 'Filter rows where column Y > 2')"
                      className="tab-form-control"
                      style={{ minHeight: '100px', resize: 'vertical', width: '96.5%' }}
                    />
                  </div>
                  <button
                    onClick={handleFilterSubmit}
                    disabled={isFiltering || !filterQuery.trim()}
                    className="tab-button"
                  >
                    {isFiltering ? 'Applying Filter...' : 'Apply Filter'}
                  </button>
                </div>

                {filterDescription && (
                  <div className="tab-section">
                    <div className="tab-section-header">
                      <div className="tab-section-title">
                        <i className="fas fa-info-circle"></i>
                        Applied Filter
                      </div>
                    </div>
                    <div>{filterDescription}</div>
                  </div>
                )}

                {error && (
                  <div className="tab-section" style={{ borderColor: 'var(--error)' }}>
                    <div className="tab-section-header">
                      <div className="tab-section-title" style={{ color: 'var(--error)' }}>
                        <i className="fas fa-exclamation-circle"></i>
                        Error
                      </div>
                    </div>
                    <div style={{ color: 'var(--error)' }}>{error}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="tab-content-body" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                  Please upload data first before filtering.
                </p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="tab-button"
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        );
      case 'analyze':
        return (
          <div className="tab-content-container">
            <DataAnalysis 
              data={uploadedData} 
              fileId={selectedFile ? selectedFile.id : null} 
            />
          </div>
        );
      case 'visualize':
        return (
          <div className="tab-content-container">
            <div className="tab-content-header">
              <h2>Data Visualization</h2>
            </div>
            <DataVisualization data={uploadedData} />
          </div>
        );
      case 'export':
        return (
          <div className="tab-content-container">
            <div className="tab-content-header">
              <h2>Export Data</h2>
            </div>
            <div className="tab-section">
              <div className="tab-section-header">
                <div className="tab-section-title">
                  <i className="fas fa-file-export"></i>
                  Export Options
                </div>
              </div>
              <p style={{ color: 'var(--text-light)' }}>Export functionality coming soon...</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderHistoryPopup = () => {
    if (!showHistoryPopup) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "var(--card-bg)",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          width: "80%",
          maxWidth: "600px",
          maxHeight: "80vh",
          overflow: "auto",
          zIndex: 1000
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ color: "var(--text-dark)", margin: 0 }}>Filter History</h2>
          <button
            onClick={() => setShowHistoryPopup(false)}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "var(--text-light)",
              cursor: "pointer",
              fontSize: "1.5rem",
              padding: "0.5rem"
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {versionNumbers.map((version, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "var(--background-light)",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onClick={() => handleHistoryClick(index)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ 
                    backgroundColor: "var(--primary-color)", 
                    color: "var(--white)", 
                    padding: "0.25rem 0.5rem", 
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                    fontWeight: "500"
                  }}>
                    Version {version}
                  </span>
                  {index === versionNumbers.length - 1 && (
                    <span style={{ 
                      backgroundColor: "var(--success)", 
                      color: "var(--white)", 
                      padding: "0.25rem 0.5rem", 
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      fontWeight: "500"
                    }}>
                      Current
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(version);
                  }}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "var(--error)",
                    cursor: "pointer",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--error-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
              <div style={{ color: "var(--text-dark)" }}>
                {historyDescriptions[index] || "No description available"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDeleteConfirm = () => {
    if (!showDeleteConfirm) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001
      }}>
        <div style={{
          backgroundColor: 'var(--white)',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '90%'
        }}>
          <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Delete Version</h3>
          <p style={{ color: 'var(--text-dark)', marginBottom: '1.5rem' }}>
            Are you sure you want to delete this version? This action cannot be undone.
          </p>
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleDeleteCancel}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--text-dark)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--background-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--white)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--error)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--white)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--error-dark)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--error)';
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOriginalDataPopup = () => {
    if (!showOriginalDataPopup) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'var(--white)',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          maxWidth: '90%',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: 'var(--text-dark)', margin: 0 }}>Current Data</h3>
            <button
              onClick={() => setShowOriginalDataPopup(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-dark)',
                cursor: 'pointer',
                fontSize: '1.5rem'
              }}
            >
              ×
            </button>
          </div>
          <DataTable 
            data={dataHistory[currentHistoryIndex]} 
            fileId={selectedFile ? selectedFile.id : null}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <Sidebar 
        onFileSelect={handleFileSelect} 
        onLogout={onLogout}
        onToggle={handleSidebarToggle}
        currentWorkspace={currentWorkspace}
      />
      <div 
        className="dashboard-content"
        style={{ 
          marginLeft: isSidebarCollapsed ? '60px' : '240px',
          padding: '0',
          transition: 'margin-left 0.3s ease',
          height: 'auto',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* New Header Section */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Left side - Dropdowns */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* My Workspace Dropdown */}
            <div className="workspace-dropdown" style={{ position: 'relative' }}>
              <button 
                onClick={handleWorkspaceClick}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-dark)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-dark)';
                }}
              >
                {currentWorkspace ? currentWorkspace.name : 'My Workspace'} <i className="fas fa-chevron-down"></i>
              </button>
              {showWorkspaceDropdown && (
                <div className="dropdown-menu" style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  padding: '0.5rem 0',
                  minWidth: '200px',
                  zIndex: 1000,
                  height: '6rem',
                  marginTop: '0.5rem',
                  animation: 'dropdownFadeIn 0.2s ease'
                }}>
                  <button
                    onClick={() => {
                      setActiveTab('upload');
                      setShowWorkspaceDropdown(false);
                    }}
                    className="dropdown-item"
                  >
                    <i className="fas fa-upload"></i>
                    Upload New
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateWorkspace(true);
                      setShowWorkspaceDropdown(false);
                    }}
                    className="dropdown-item"
                  >
                    <i className="fas fa-plus"></i>
                    New Workspace
                  </button>
                  <button
                    onClick={() => {
                      setShowManageWorkspaces(true);
                      setShowWorkspaceDropdown(false);
                    }}
                    className="dropdown-item"
                  >
                    <i className="fas fa-cog"></i>
                    Manage Workspaces
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              borderLeft: '1px solid var(--border-color)',
              paddingLeft: '1rem'
            }}>
              <button className="icon-button" title="Copy">
                <i className="fas fa-copy"></i>
              </button>

              {/* Summarize Button with Dropdown */}
              <div className="dropdown-container" style={{ position: 'relative' }}>
                <button 
                  className="icon-button" 
                  title="Summarize"
                  onClick={handleSummarizeClick}
                >
                  <i className="fas fa-list"></i>
                </button>
                {showSummarizeDropdown && (
                  <div className="dropdown-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    padding: '0.5rem 0',
                    minWidth: '150px',
                    zIndex: 1000,
                    height: '12rem',
                    marginTop: '0.5rem'
                  }}>
                    <button className="dropdown-item" onClick={() => console.log('SUM clicked')}>
                      <i className="fas fa-plus"></i>
                      SUM
                    </button>
                    <button className="dropdown-item" onClick={() => console.log('AVERAGE clicked')}>
                      <i className="fas fa-calculator"></i>
                      AVERAGE
                    </button>
                    <button className="dropdown-item" onClick={() => console.log('MIN clicked')}>
                      <i className="fas fa-arrow-down"></i>
                      MIN
                    </button>
                    <button className="dropdown-item" onClick={() => console.log('MAX clicked')}>
                      <i className="fas fa-arrow-up"></i>
                      MAX
                    </button>
                    <button className="dropdown-item" onClick={() => console.log('COUNT clicked')}>
                      <i className="fas fa-hashtag"></i>
                      COUNT
                    </button>
                    <button className="dropdown-item" onClick={() => console.log('PRODUCT clicked')}>
                      <i className="fas fa-times"></i>
                      PRODUCT
                    </button>
                  </div>
                )}
              </div>

              <button 
                className="icon-button" 
                title="History"
                onClick={() => setShowHistoryPopup(true)}
              >
                <i className="fas fa-history"></i>
              </button>
              <button 
                className="icon-button" 
                title="View Data"
                onClick={() => setShowOriginalDataPopup(true)}
              >
                <i className="fas fa-table"></i>
              </button>
            </div>
          </div>

          {/* Right side - Tabs */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <button 
                onClick={() => navigate('/ai-analyst', { 
                  state: { currentFile: selectedFile }
                })}
                className="pro-ai-button"
                title="AI Data Analyst Pro"
              >
                <span className="pro-ai-text">AI Analyst</span>
                <span className="pro-badge">PRO</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`header-tab ${activeTab === 'upload' ? 'active' : ''}`}
              title="Upload Data"
            >
              <i className={`fas ${tabs[0].icon}`}></i>
            </button>
            <button
              onClick={() => setActiveTab('filter')}
              className={`header-tab ${activeTab === 'filter' ? 'active' : ''}`}
              title="Filter Data"
            >
              <i className={`fas ${tabs[1].icon}`}></i>
            </button>
            <button
              onClick={() => setActiveTab('analyze')}
              className={`header-tab ${activeTab === 'analyze' ? 'active' : ''}`}
              title="Analyze Data"
            >
              <i className={`fas ${tabs[2].icon}`}></i>
            </button>
            <button
              onClick={() => setActiveTab('visualize')}
              className={`header-tab ${activeTab === 'visualize' ? 'active' : ''}`}
              title="Visualize"
            >
              <i className={`fas ${tabs[3].icon}`}></i>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`header-tab ${activeTab === 'export' ? 'active' : ''}`}
              title="Export Data"
            >
              <i className={`fas ${tabs[4].icon}`}></i>
            </button>
          </div>
        </div>

        {renderTabContent()}

        {renderHistoryPopup()}

        {renderDeleteConfirm()}

        {renderOriginalDataPopup()}

        {/* Create Workspace Modal */}
        {showCreateWorkspace && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001,
          }}>
            <div style={{
              backgroundColor: 'var(--white)',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Create New Workspace</h3>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px'
                }}
              />
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setShowCreateWorkspace(false);
                    setNewWorkspaceName("");
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!newWorkspaceName.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--primary-color)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--white)',
                    opacity: !newWorkspaceName.trim() ? 0.5 : 1
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Workspace Confirmation Modal */}
        {showDeleteWorkspaceConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001
          }}>
            <div style={{
              backgroundColor: 'var(--white)',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Delete Workspace</h3>
              <p style={{ color: 'var(--text-dark)', marginBottom: '1.5rem' }}>
                Are you sure you want to delete "{workspaceToDelete?.name}"? This action cannot be undone.
              </p>
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setShowDeleteWorkspaceConfirm(false);
                    setWorkspaceToDelete(null);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkspace}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--error)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--white)'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manage Workspaces Modal */}
        {showManageWorkspaces && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001
          }}>
            <div style={{
              backgroundColor: 'var(--white)',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ color: 'var(--text-dark)', margin: 0 }}>Manage Workspaces</h3>
                <button
                  onClick={() => setShowManageWorkspaces(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-dark)',
                    cursor: 'pointer',
                    fontSize: '1.2rem'
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      backgroundColor: currentWorkspace?.id === workspace.id ? 'var(--primary-light)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      setCurrentWorkspace(workspace);
                      setShowManageWorkspaces(false);
                    }}
                    onMouseEnter={(e) => {
                      if (currentWorkspace?.id !== workspace.id) {
                        e.currentTarget.style.backgroundColor = 'var(--background-light)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentWorkspace?.id !== workspace.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <i className="fas fa-folder" style={{
                          color: currentWorkspace?.id === workspace.id ? 'var(--primary-color)' : 'var(--text-light)'
                        }}></i>
                        <span style={{
                          color: currentWorkspace?.id === workspace.id ? 'var(--primary-color)' : 'var(--text-dark)'
                        }}>
                          {workspace.name}
                        </span>
                      </div>
                      {workspace.is_default && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-light)',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'var(--background-light)',
                          borderRadius: '4px'
                        }}>
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;