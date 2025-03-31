import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from './FileUpload';
import './styles/global.css';

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedData, setUploadedData] = useState(null);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const tabs = [
    { id: 'upload', label: 'Upload Data' },
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
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'upload':
        return (
          <FileUpload 
            onDataUpload={handleDataUpload}
            existingData={uploadedData}
          />
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
        <h2 style={{ color: 'var(--primary-color)', margin: 0 }}>Data Monarch</h2>
        <button 
          onClick={handleLogout}
          className="btn btn-danger"
        >
          Logout
        </button>
      </nav>

      <div className="container">
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
  );
}

export default Dashboard; 