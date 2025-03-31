import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from './FileUpload';
import Sidebar from './SideBar';
import ThemeToggle from './components/ThemeToggle';
import config from './config';
import './styles/global.css';

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedData, setUploadedData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(null);

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

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/data/${file.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch file data');
      }
      
      const data = await response.json();
      setUploadedData(data.data);
      // Initialize visible columns when file is selected
      const initialVisible = {};
      Object.keys(data.data[0] || {}).forEach(column => {
        initialVisible[column] = true;
      });
      setVisibleColumns(initialVisible);
      setActiveTab('view');
    } catch (error) {
      console.error('Error loading file:', error);
      setError('Failed to load file data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'upload', label: 'Upload Data' },
    { id: 'view', label: 'View Data' },
    { id: 'clean', label: 'Clean Data' },
    { id: 'filter', label: 'Filter Data' },
    { id: 'analyze', label: 'Analyze Data' },
    { id: 'visualize', label: 'Visualize' },
    { id: 'export', label: 'Export Data' }
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
    // Initialize visible columns when data is uploaded
    const initialVisible = {};
    Object.keys(data[0] || {}).forEach(column => {
      initialVisible[column] = true;
    });
    setVisibleColumns(initialVisible);
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
        <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map(column => (
                visibleColumns[column] && (
                  <th 
                    key={column}
                    style={{
                      width: `${100 / Object.values(visibleColumns).filter(Boolean).length}%`,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {column}
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody>
            {uploadedData.map((row, index) => (
              <tr key={index}>
                {columns.map(column => (
                  visibleColumns[column] && (
                    <td 
                      key={column}
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {row[column]}
                    </td>
                  )
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem'
        }}>
          <div className="loading-spinner" />
        </div>
      );
    }

    if (error) {
      return (
        <div style={{
          color: 'var(--error)',
          padding: '1rem',
          textAlign: 'center'
        }}>
          {error}
        </div>
      );
    }

    switch (activeTab) {
      case 'upload':
        return (
          <FileUpload 
            onDataUpload={handleDataUpload}
            existingData={uploadedData}
          />
        );
      case 'view':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">View Data</h2>
            {uploadedData && uploadedData.length > 0 ? (
              renderDataTable()
            ) : (
              <p className="text-gray-500">No data available. Please upload a file or select one from your history.</p>
            )}
          </div>
        );
      case 'clean':
        return (
          <div className="card">
            {uploadedData ? (
              <div>
                <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Clean Data</h3>
                <p>Data cleaning functionality coming soon...</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--error)' }}>Please upload data first before cleaning.</p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        );
      case 'filter':
        return (
          <div className="card">
            {uploadedData ? (
              <div>
                <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Filter Data</h3>
                <p>Data filtering functionality coming soon...</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--error)' }}>Please upload data first before filtering.</p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        );
      case 'analyze':
        return (
          <div className="card">
            {uploadedData ? (
              <div>
                <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Analyze Data</h3>
                <p>Data analysis functionality coming soon...</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--error)' }}>Please upload data first before analyzing.</p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        );
      case 'visualize':
        return (
          <div className="card">
            {uploadedData ? (
              <div>
                <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Visualize Data</h3>
                <p>Data visualization functionality coming soon...</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--error)' }}>Please upload data first before visualizing.</p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        );
      case 'export':
        return (
          <div className="card">
            {uploadedData ? (
              <div>
                <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Export Data</h3>
                <p>Data export functionality coming soon...</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--error)' }}>Please upload data first before exporting.</p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dashboard">
      <nav className="navbar" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: 'var(--white)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ color: 'var(--primary-color)', margin: 0 }}>Data Monarch</h2>
          <ThemeToggle />
        </div>
        <button 
          onClick={handleLogout}
          className="btn btn-danger"
        >
          Logout
        </button>
      </nav>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <Sidebar onFileSelect={handleFileSelect} />
        <div className="container" style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="btn"
                style={{
                  backgroundColor: activeTab === tab.id ? 'var(--primary-color)' : 'var(--white)',
                  color: activeTab === tab.id ? 'var(--white)' : 'var(--text-dark)',
                  border: activeTab === tab.id ? 'none' : '1px solid var(--border-color)',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="card">
            {renderTabContent()}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '2rem',
            padding: '0 1rem'
          }}>
            <button
              onClick={handleBack}
              className="btn"
              style={{
                backgroundColor: 'var(--white)',
                color: 'var(--text-dark)',
                border: '1px solid var(--border-color)',
                opacity: currentTabIndex === 0 ? 0.5 : 1,
                cursor: currentTabIndex === 0 ? 'not-allowed' : 'pointer'
              }}
              disabled={currentTabIndex === 0}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className="btn"
              style={{
                backgroundColor: 'var(--white)',
                color: 'var(--text-dark)',
                border: '1px solid var(--border-color)',
                opacity: currentTabIndex === tabs.length - 1 ? 0.5 : 1,
                cursor: currentTabIndex === tabs.length - 1 ? 'not-allowed' : 'pointer'
              }}
              disabled={currentTabIndex === tabs.length - 1}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 