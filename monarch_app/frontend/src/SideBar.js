import React, { useEffect, useState } from "react";
import axios from "axios";
import config from "./config";

const Sidebar = ({ onFileSelect }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No token found. Please log in.");
          return;
        }

        const res = await axios.get(`${config.baseUrl}/api/files`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          withCredentials: true
        });
        setFiles(res.data);
        console.log(res.data);
      } catch (err) {
        setError("Could not load files. Please try again.");
        console.error(err);
      }
    };

    fetchFiles();
  }, []);

  const handleFileClick = (file) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleNewUpload = () => {
    // Reset the selected file
    setSelectedFile(null);
    // Call onFileSelect with null to indicate a new upload
    onFileSelect(null);
  };

  return (
    <aside style={{ 
      width: "300px", 
      borderRight: "1px solid var(--border-color)", 
      padding: "1.5rem",
      backgroundColor: "var(--white)",
      boxShadow: "2px 0 5px rgba(0, 0, 0, 0.05)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1.5rem"
      }}>
        <h2 style={{ 
          color: "var(--text-dark)",
          fontSize: "1.5rem",
          fontWeight: "600",
          margin: 0
        }}>My Uploaded Files</h2>
        <button
          onClick={handleNewUpload}
          style={{
            backgroundColor: "var(--primary-color)",
            color: "var(--white)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.backgroundColor = "var(--primary-color-dark)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.backgroundColor = "var(--primary-color)";
          }}
        >
          <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>+</span>
        </button>
      </div>
      {error && <p style={{ color: "var(--error)", marginBottom: "1rem" }}>{error}</p>}
      {files.length > 0 ? (
        <ul style={{ 
          listStyleType: "none", 
          paddingLeft: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}>
          {files.map((file) => (
            <li 
              key={file.id} 
              style={{ 
                cursor: "pointer",
                padding: "1rem",
                backgroundColor: selectedFile?.id === file.id 
                  ? "var(--primary-color-light)" 
                  : "var(--white)",
                borderRadius: "8px",
                border: selectedFile?.id === file.id
                  ? "2px solid var(--primary-color)"
                  : "1px solid var(--border-color)",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                ":hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                  borderColor: "var(--primary-color)",
                  backgroundColor: "var(--primary-color-light)"
                }
              }}
              onClick={() => handleFileClick(file)}
              onMouseEnter={(e) => {
                if (selectedFile?.id !== file.id) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.borderColor = "var(--primary-color)";
                  e.currentTarget.style.backgroundColor = "var(--primary-color-light)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFile?.id !== file.id) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.backgroundColor = "var(--white)";
                }
              }}
            >
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "0.5rem",
                marginBottom: "0.5rem"
              }}>
                <span style={{ 
                  color: "var(--primary-color)",
                  fontSize: "1.2rem"
                }}>📄</span>
                <strong style={{ 
                  color: "var(--text-dark)",
                  fontSize: "1rem"
                }}>{file.filename}</strong>
              </div>
              <small style={{ 
                color: "var(--text-light)",
                display: "block"
              }}>
                Uploaded: {new Date(file.created_at).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ 
          color: "var(--text-light)",
          textAlign: "center",
          padding: "2rem",
          backgroundColor: "var(--background-light)",
          borderRadius: "8px"
        }}>No files found.</p>
      )}
    </aside>
  );
};

export default Sidebar;
