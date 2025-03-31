import React, { useEffect, useState } from "react";
import axios from "axios";
import config from "./config";

const Sidebar = ({ onFileSelect }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

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

  const handleDeleteClick = (file, event) => {
    event.stopPropagation(); // Prevent file selection when clicking delete
    setFileToDelete(file);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${config.baseUrl}/api/files/${fileToDelete.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        withCredentials: true
      });

      // Remove the file from the local state
      setFiles(files.filter(f => f.id !== fileToDelete.id));
      
      // If the deleted file was selected, clear the selection
      if (selectedFile?.id === fileToDelete.id) {
        setSelectedFile(null);
        onFileSelect(null);
      }

      setShowDeleteConfirm(false);
      setFileToDelete(null);
    } catch (err) {
      setError("Failed to delete file. Please try again.");
      console.error(err);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setFileToDelete(null);
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
                position: "relative",
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
                  fontSize: "1rem",
                  flex: 1
                }}>{file.filename}</strong>
                <button
                  onClick={(e) => handleDeleteClick(file, e)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "var(--error)",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--error-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>🗑️</span>
                </button>
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "var(--white)",
            padding: "2rem",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            maxWidth: "400px",
            width: "90%"
          }}>
            <h3 style={{ 
              color: "var(--text-dark)",
              marginBottom: "1rem"
            }}>Delete File</h3>
            <p style={{ 
              color: "var(--text-dark)",
              marginBottom: "1.5rem"
            }}>
              Are you sure you want to delete "{fileToDelete?.filename}"? This action cannot be undone.
            </p>
            <div style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "flex-end"
            }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--white)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  color: "var(--text-dark)",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--background-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--white)";
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--error)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  color: "var(--white)",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--error-dark)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--error)";
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
