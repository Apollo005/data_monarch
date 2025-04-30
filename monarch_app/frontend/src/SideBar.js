import React, { useEffect, useState } from "react";
import axios from "axios";
import config from "./config";

const Sidebar = ({ onFileSelect, onLogout, onToggle, currentWorkspace }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [username, setUsername] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(null);
  const [newFileName, setNewFileName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No token found. Please log in.");
          return;
        }

        // Fetch username from token
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        setUsername(tokenPayload.sub);

        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
          setIsDarkMode(true);
          document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Fetch files for current workspace
        if (currentWorkspace) {
          await fetchWorkspaceFiles(currentWorkspace.id);
        }

      } catch (err) {
        setError("Could not load data. Please try again.");
        console.error(err);
      }
    };

    fetchData();

    // Add event listener for file uploads
    const handleFileUploaded = (event) => {
      if (currentWorkspace && event.detail.workspaceId === currentWorkspace.id) {
        fetchWorkspaceFiles(currentWorkspace.id);
      }
    };

    window.addEventListener('fileUploaded', handleFileUploaded);

    // Cleanup event listener
    return () => {
      window.removeEventListener('fileUploaded', handleFileUploaded);
    };
  }, [currentWorkspace]);

  const fetchWorkspaceFiles = async (workspaceId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${config.baseUrl}/api/workspaces/${workspaceId}/files`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        withCredentials: true,
      });
      setFiles(response.data);
    } catch (err) {
      setError("Could not load files. Please try again.");
      console.error(err);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleNewUpload = () => {
    setSelectedFile(null);
    onFileSelect(null);
  };

  const handleDeleteClick = (file, event) => {
    event.stopPropagation();
    setFileToDelete(file);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${config.baseUrl}/api/files/${fileToDelete.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        withCredentials: true,
      });

      setFiles(files.filter((f) => f.id !== fileToDelete.id));

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

  const handleSidebarToggle = () => {
    setIsCollapsed(!isCollapsed);
    const event = new CustomEvent('sidebarToggle', { 
      detail: { collapsed: !isCollapsed } 
    });
    window.dispatchEvent(event);
    onToggle(!isCollapsed);
  };

  const handleRenameClick = (file, event) => {
    event.stopPropagation();
    setIsRenaming(file.id);
    setNewFileName(file.filename);
    setShowFileMenu(null);
  };

  const handleRenameSubmit = async (file, event) => {
    event.preventDefault();
    if (!newFileName.trim() || newFileName === file.filename) {
      setIsRenaming(null);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${config.baseUrl}/api/files/${file.id}`, 
        { filename: newFileName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          withCredentials: true,
        }
      );

      setFiles(files.map(f => 
        f.id === file.id ? { ...f, filename: newFileName } : f
      ));
      setIsRenaming(null);
    } catch (err) {
      setError("Failed to rename file. Please try again.");
      console.error(err);
    }
  };

  const handleFileMenuClick = (fileId, event) => {
    event.stopPropagation();
    setShowFileMenu(showFileMenu === fileId ? null : fileId);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFileMenu && !event.target.closest('.file-menu') && !event.target.closest('.file-menu-trigger')) {
        setShowFileMenu(null);
      }
      
      if (showUserMenu && !event.target.closest('.user-menu') && !event.target.closest('.user-profile-trigger')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFileMenu, showUserMenu]);

  const toggleUserMenu = (event) => {
    event.stopPropagation();
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
  };

  const handleSettings = () => {
    setShowUserMenu(false);
    console.log("Settings clicked");
  };

  const handleProfile = () => {
    setShowUserMenu(false);
    console.log("Profile clicked");
  };

  return (
    <aside
      style={{
        width: isCollapsed ? "60px" : "240px",
        borderRadius: "0",
        borderRight: "1px solid var(--border-color)",
        padding: isCollapsed ? "0.5rem" : "1rem",
        backgroundColor: "var(--card-bg)",
        boxShadow: "2px 0 5px rgba(0, 0, 0, 0.05)",
        transition: "all 0.3s ease",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        zIndex: 1000
      }}
    >
      {/* Toggle button */}
      <button
        onClick={handleSidebarToggle}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          width: "32px",
          height: "32px",
          borderRadius: "6px",
          backgroundColor: "transparent",
          border: "1px solid var(--border-color)",
          color: "var(--text-dark)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
          fontSize: "1rem",
          transition: "all 0.2s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--background-light)";
          e.currentTarget.style.color = "var(--primary-color)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--text-dark)";
        }}
      >
        <i className={`fas fa-${isCollapsed ? 'chevron-right' : 'chevron-left'}`}></i>
      </button>

      {/* Files section */}
      <div style={{
        flex: 1,
        overflowY: "hidden",
        marginTop: "4rem",
        opacity: isCollapsed ? 0 : 1,
        transition: "opacity 0.3s ease",
        flexShrink: 0,
        paddingBottom: "2.5rem",
        borderBottom: "1px solid var(--border-color)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          padding: "0 0.5rem"
        }}>
          <h2 style={{
            color: "var(--text-dark)",
            fontSize: "0.9rem",
            fontWeight: "600",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>
            Files
          </h2>
          <button
            onClick={handleNewUpload}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              backgroundColor: "var(--primary-color)",
              border: "none",
              color: "var(--white)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "1rem",
              transition: "all 0.2s ease"
            }}
            title="New Upload"
          >
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>

        {/* Files list - moved up */}
        <div style={{
          overflowY: "auto",
          opacity: isCollapsed ? 0 : 1,
          transition: "opacity 0.3s ease",
          pointerEvents: isCollapsed ? "none" : "auto",
          visibility: isCollapsed ? "hidden" : "visible",
          height: "100vh",
        }}>
          {error && (
            <p style={{
              color: "var(--error)",
              fontSize: "0.875rem",
              padding: "0.5rem",
              margin: "0 0.5rem",
              backgroundColor: "var(--error-light)",
              borderRadius: "4px"
            }}>
              {error}
            </p>
          )}

          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => handleFileClick(file)}
              className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                overflow: "hidden",
                flex: 1
              }}>
                <i className={`fas fa-${getFileIcon(file.file_type)}`} style={{ 
                  fontSize: "0.875rem",
                  color: selectedFile?.id === file.id ? "var(--primary-color)" : "var(--text-light)"
                }}></i>
                {isRenaming === file.id ? (
                  <form onSubmit={(e) => handleRenameSubmit(file, e)} style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onBlur={(e) => handleRenameSubmit(file, e)}
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "0.25rem 0.5rem",
                        border: "1px solid var(--primary-color)",
                        borderRadius: "4px",
                        fontSize: "0.875rem"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </form>
                ) : (
                  <span style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {file.filename}
                  </span>
                )}
              </div>
              
              <div className="file-actions">
                <button
                  className="file-menu-trigger"
                  onClick={(e) => handleFileMenuClick(file.id, e)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "var(--text-light)",
                    cursor: "pointer",
                    padding: "0.25rem",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.2s ease"
                  }}
                >
                  <i className="fas fa-ellipsis-h"></i>
                </button>

              {showFileMenu === file.id && (
                <div className="file-menu">
                  <button
                    className="file-menu-item"
                    onClick={(e) => handleRenameClick(file, e)}
                  >
                    <i className="fas fa-edit"></i>
                    Rename
                  </button>
                  <button
                    className="file-menu-item delete"
                    onClick={(e) => handleDeleteClick(file, e)}
                  >
                    <i className="fas fa-trash-alt"></i>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* User section at bottom */}
      <div style={{
        borderTop: "1px solid var(--border-color)",
        padding: "1rem 0.5rem",
        opacity: isCollapsed ? 0 : 1,
        transition: "opacity 0.3s ease",
        marginTop: "auto",
        position: "relative"
      }}>
        <button
          className="user-profile-trigger"
          onClick={toggleUserMenu}
          style={{
            width: "100%",
            padding: "0.5rem",
            backgroundColor: "transparent",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-dark)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--background-light)";
            e.currentTarget.style.borderColor = "var(--primary-color)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.borderColor = "var(--border-color)";
          }}
        >
          <i className="fas fa-user-circle"></i>
          <span>{username || "User"}</span>
          <i className="fas fa-chevron-down" style={{ marginLeft: "auto", fontSize: "0.75rem" }}></i>
        </button>

        {showUserMenu && (
          <div className="user-menu" style={{
            position: "absolute",
            bottom: "100%",
            left: "0.5rem",
            right: "0.5rem",
            backgroundColor: "var(--white)",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            padding: "0.5rem",
            zIndex: 1000,
            marginBottom: "0.5rem",
            animation: "menuFadeIn 0.2s ease"
          }}>
            <div style={{
              padding: "0.5rem",
              borderBottom: "1px solid var(--border-color)",
              marginBottom: "0.5rem"
            }}>
              <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{username || "User"}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>Signed in</div>
            </div>
            
            <button
              className="file-menu-item"
              onClick={handleProfile}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <i className="fas fa-user"></i>
              Profile
            </button>
            
            <button
              className="file-menu-item"
              onClick={handleSettings}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <i className="fas fa-cog"></i>
              Settings
            </button>
            
            <button
              className="file-menu-item"
              onClick={toggleTheme}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <i className={`fas fa-${isDarkMode ? 'sun' : 'moon'}`}></i>
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            
            <div style={{ 
              height: "1px", 
              backgroundColor: "var(--border-color)", 
              margin: "0.5rem 0" 
            }}></div>
            
            <button
              className="file-menu-item"
              onClick={handleLogout}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--error)"
              }}
            >
              <i className="fas fa-sign-out-alt"></i>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
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
          zIndex: 1100
        }}>
          <div style={{
            backgroundColor: "var(--white)",
            padding: "1.5rem",
            borderRadius: "8px",
            width: "90%",
            maxWidth: "400px"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Delete File</h3>
            <p>Are you sure you want to delete {fileToDelete?.filename}?</p>
            <div style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "flex-end",
              marginTop: "1.5rem"
            }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--background-light)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--error)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
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

// Helper function to get file icon based on file type
function getFileIcon(fileType) {
  switch (fileType) {
    case 'csv':
      return 'file-csv';
    case 'xlsx':
      return 'file-excel';
    case 'pdf':
      return 'file-pdf';
    case 'txt':
      return 'file-alt';
    case 'json':
    case 'jsonl':
      return 'file-code';
    default:
      return 'file';
  }
}