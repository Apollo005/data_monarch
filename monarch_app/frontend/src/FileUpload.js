import React, { useState, useRef } from "react";
import axios from "axios";
import DataTable from "./DataTable";
import config from './config';

const FileUpload = ({ onDataUpload, existingData }) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [fileData, setFileData] = useState(existingData);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
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

    try {
      const response = await axios.post(`${config.baseUrl}/api/data/upload`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        },
      });

      setMessage("Upload successful!");
      setFileData(response.data.data);
      onDataUpload(response.data.data);
    } catch (error) {
      if (error.response?.status === 401) {
        setMessage("Session expired. Please log in again.");
      } else {
        setMessage("Upload failed");
      }
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div className="file-upload-container">
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Upload a File</h2>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div className="file-input-wrapper" style={{ flex: 1 }}>
            <input
              type="file"
              onChange={handleFileChange}
              ref={fileInputRef}
              id="file-input"
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

        {message && (
          <p style={{ 
            color: message.includes("failed") || message.includes("expired") ? "var(--error)" : "var(--success)",
            fontWeight: "500"
          }}>
            {message}
          </p>
        )}
      </div>

      {fileData && (
        <div className="card">
          <h3 style={{ color: 'var(--text-dark)', marginBottom: '1rem' }}>Data Preview</h3>
          <DataTable data={fileData} />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
