import React, { useState, useRef } from "react";
import axios from "axios";
import DataTable from "./DataTable";
import config from './config';

const FileUpload = ({ onDataUpload, existingData }) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [fileData, setFileData] = useState(existingData);
  const [columnNames, setColumnNames] = useState("");
  const [showColumnInput, setShowColumnInput] = useState(false);
  const [columnError, setColumnError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setColumnError("");
    
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (fileExtension === 'txt') {
        setShowColumnInput(true);
      } else {
        setShowColumnInput(false);
        setColumnNames("");
      }
    }
  };

  const handleColumnNamesChange = (event) => {
    setColumnNames(event.target.value);
    setColumnError("");
  };

  const validateColumnNames = (names, data) => {
    if (!names.trim()) {
      return "Please enter column names";
    }
    
    const columns = names.split(',').map(col => col.trim()).filter(col => col);
    const firstRow = data[0];
    
    if (columns.length !== Object.keys(firstRow).length) {
      return `Number of columns (${columns.length}) doesn't match the data (${Object.keys(firstRow).length} columns)`;
    }
    
    return null;
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage("Please select a file first!");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Please log in to upload files");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // If it's a txt file and column names are provided, add them to formData
    if (file.name.endsWith('.txt') && columnNames.trim()) {
      formData.append("column_names", columnNames);
    }

    try {
      const response = await axios.post(`${config.baseUrl}/api/data/upload/`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        },
        withCredentials: true
      });

      const data = response.data.data;
      setFileData(data);
      onDataUpload(data);
      setMessage("Upload successful!");
    } catch (error) {
      if (error.response?.status === 401) {
        setMessage("Session expired. Please log in again.");
      } else if (error.response?.status === 400) {
        setColumnError(error.response.data.detail);
      } else {
        setMessage("Upload failed");
      }
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div className="file-upload-container">
      {!fileData ? (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Upload a File</h2>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div className="file-input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="file"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  id="file-input"
                  accept=".csv,.txt,.xlsx,.xls"
                />
                <label htmlFor="file-input" className="file-input-label">
                  Choose File
                </label>
                {file && <span className="file-name">{file.name}</span>}
              </div>

              <button 
                onClick={handleUpload}
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                Upload
              </button>
            </div>

            {showColumnInput && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                width: '100%'
              }}>
                <label 
                  htmlFor="column-names"
                  style={{
                    color: 'var(--text-dark)',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  Column Names (comma-separated)
                </label>
                <div style={{
                  position: 'relative',
                  width: '100%'
                }}>
                  <input
                    type="text"
                    id="column-names"
                    value={columnNames}
                    onChange={handleColumnNamesChange}
                    placeholder="e.g., Name, Age, Email, Phone"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: columnError ? '2px solid var(--error)' : '1px solid var(--border-color)',
                      backgroundColor: 'var(--white)',
                      color: 'var(--text-dark)',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--primary-color)';
                      e.target.style.boxShadow = '0 0 0 2px var(--primary-color-light)';
                    }}
                    onBlur={(e) => {
                      if (!columnError) {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                      }
                    }}
                  />
                  {columnError && (
                    <div style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--error)',
                      fontSize: '1.2rem'
                    }}>
                      ⚠️
                    </div>
                  )}
                </div>
                {columnError && (
                  <p style={{
                    color: 'var(--error)',
                    fontSize: '0.85rem',
                    margin: 0
                  }}>
                    {columnError}
                  </p>
                )}
              </div>
            )}
          </div>

          {message && (
            <p style={{ 
              color: message.includes("failed") || message.includes("expired") ? "var(--error)" : "var(--success)",
              fontWeight: "500"
            }}>
              {message}
            </p>
          )}
        </div>
      ) : (
        <div className="card">
          <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Data Preview</h3>
          <DataTable data={fileData} />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
