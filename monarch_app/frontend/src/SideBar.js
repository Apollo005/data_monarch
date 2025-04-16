import React, { useEffect, useState } from "react";
import axios from "axios";
import config from "./config";

const Sidebar = ({ onFileSelect, onLogout, onToggle }) => {
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

  useEffect(() => {
    const fetchFiles = async () => {
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

        const res = await axios.get(`${config.baseUrl}/api/files`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          withCredentials: true,
        });
        setFiles(res.data);
      } catch (err) {
        setError("Could not load files. Please try again.");
        console.error(err);
      }
    };

    fetchFiles();
  }, []);

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
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        withCredentials: true,
      });

      // Remove the file from the local state
      setFiles(files.filter((f) => f.id !== fileToDelete.id));

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

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    onToggle(!isCollapsed);
  };

  return (
    <aside
      style={{
        width: isCollapsed ? "60px" : "240px",
        borderRadius: "0",
        border: "1px solid var(--border-color)",
        padding: isCollapsed ? "0.5rem" : "1.5rem",
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
      {/* Toggle button at the top-left */}
      <button
        onClick={toggleSidebar}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          backgroundColor: "var(--primary-color)",
          border: "none",
          color: "var(--white)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
          fontSize: "1.2rem",
          boxShadow: "0 0 8px var(--primary-light)",
          transition: "transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "rotate(90deg) scale(1.1)";
          e.currentTarget.style.backgroundColor = "var(--primary-dark)";
          e.currentTarget.style.boxShadow = "0 0 12px var(--primary-color)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "rotate(0deg) scale(1)";
          e.currentTarget.style.backgroundColor = "var(--primary-color)";
          e.currentTarget.style.boxShadow = "0 0 8px var(--primary-light)";
        }}
      >
        {isCollapsed ? "≡" : "≡"}
      </button>

      {/* Title & "New Upload" button */}
      <div
        style={{
          // Push content down so it doesn't overlap the toggle button
          marginTop: "3rem",
          opacity: isCollapsed ? 0 : 1,
          transition: "opacity 0.3s ease",
          flexShrink: 0, // Prevent header from shrinking
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              color: "var(--text-dark)",
              fontSize: "1.1rem",
              fontWeight: "600",
              margin: 0,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            My Uploaded Files
          </h2>
          <button
            onClick={handleNewUpload}
            style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--primary-color)",
                border: "none",
                color: "var(--white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
                fontSize: "1.2rem",
                boxShadow: "0 0 8px var(--primary-light)",
                transition: "transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "rotate(90deg) scale(1.1)";
                e.currentTarget.style.backgroundColor = "var(--primary-dark)";
                e.currentTarget.style.boxShadow = "0 0 12px var(--primary-color)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "rotate(0deg) scale(1)";
                e.currentTarget.style.backgroundColor = "var(--primary-color)";
                e.currentTarget.style.boxShadow = "0 0 8px var(--primary-light)";
            }}
          >
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>+</span>
          </button>
        </div>

        {error && (
          <p
            style={{
              color: "var(--error)",
              marginBottom: "1rem",
            }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "0.5rem",
          opacity: isCollapsed ? 0 : 1,
          transition: "opacity 0.3s ease",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--card-bg) var(--card-bg)",
        }}
      >
        {/* List of files */}
        {files.length > 0 ? (
          <ul
            style={{
              listStyleType: "none",
              paddingLeft: 10,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {files.map((file) => (
              <li
                key={file.id}
                style={{
                  cursor: "pointer",
                  padding: "1rem",
                  backgroundColor:
                    selectedFile?.id === file.id
                      ? "var(--primary-color-light)"
                      : "var(--white)",
                  borderRadius: "8px",
                  border:
                    selectedFile?.id === file.id
                      ? "2px solid var(--primary-color)"
                      : "1px solid var(--border-color)",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                  position: "relative",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                onClick={() => handleFileClick(file)}
                onMouseEnter={(e) => {
                  if (selectedFile?.id !== file.id) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px rgba(0, 0, 0, 0.1)";
                    e.currentTarget.style.borderColor = "var(--primary-color)";
                    e.currentTarget.style.backgroundColor =
                      "var(--primary-color-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFile?.id !== file.id) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 4px rgba(0, 0, 0, 0.05)";
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.backgroundColor = "var(--white)";
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      color: "var(--primary-color)",
                      fontSize: "1.2rem",
                    }}
                  >
                    📄
                  </span>
                  <strong
                    style={{
                      color: "var(--text-dark)",
                      fontSize: "1rem",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {file.filename}
                  </strong>
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
                      transition: "all 0.2s ease",
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
                <small
                  style={{
                    color: "var(--text-light)",
                    display: "block",
                  }}
                >
                  Uploaded: {new Date(file.created_at).toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{
              color: "var(--text-light)",
              textAlign: "center",
              padding: "2rem",
              backgroundColor: "var(--background-light)",
              borderRadius: "8px",
            }}
          >
            No files found.
          </p>
        )}
      </div>

      {/* User Profile Section */}
      <div
        style={{
          marginTop: "auto",
          padding: "1rem 0",
          borderTop: "1px solid var(--border-color)",
          position: "relative",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: "pointer",
            padding: "0.5rem",
            borderRadius: "8px",
            transition: "background-color 0.2s ease",
          }}
          onClick={() => setShowProfilePopup(!showProfilePopup)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "var(--primary-color)",
              color: "var(--white)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "600",
              fontSize: "1rem"
            }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  color: "var(--text-dark)",
                  fontWeight: "500",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {username}
              </div>
            </div>
          )}
          {!isCollapsed && (
            <i
              className={`fas fa-chevron-${showProfilePopup ? "up" : "down"}`}
              style={{
                color: "var(--text-light)",
                transition: "transform 0.2s ease"
              }}
            />
          )}
        </div>

        {/* Profile Popup */}
        {showProfilePopup && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "var(--white)",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              padding: "1.5rem",
              width: "calc(100% - 2rem)",
              marginBottom: "1rem",
              zIndex: 1001
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary-color)",
                  color: "var(--white)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "600",
                  fontSize: "1.5rem",
                  margin: "0 auto 1rem"
                }}
              >
                {username.charAt(0).toUpperCase()}
              </div>
              <div
                style={{
                  textAlign: "center",
                  color: "var(--text-dark)",
                  fontWeight: "600",
                  fontSize: "1.1rem",
                  marginBottom: "0.25rem"
                }}
              >
                {username}
              </div>
              <div
                style={{
                  textAlign: "center",
                  color: "var(--text-light)",
                  fontSize: "0.9rem"
                }}
              >
                Member since {new Date().getFullYear()}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease"
                }}
                onClick={toggleTheme}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <i
                    className={`fas fa-${isDarkMode ? "moon" : "sun"}`}
                    style={{ color: "var(--primary-color)", fontSize: "1.1rem" }}
                  />
                  <span style={{ color: "var(--text-dark)" }}>
                    {isDarkMode ? "Dark Mode" : "Light Mode"}
                  </span>
                </div>
                <div
                  style={{
                    width: "40px",
                    height: "20px",
                    backgroundColor: isDarkMode ? "var(--primary-color)" : "var(--border-color)",
                    borderRadius: "10px",
                    position: "relative",
                    transition: "background-color 0.2s ease"
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: "16px",
                      height: "16px",
                      backgroundColor: "var(--white)",
                      borderRadius: "50%",
                      top: "2px",
                      left: isDarkMode ? "22px" : "2px",
                      transition: "left 0.2s ease"
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <i className="fas fa-cog" style={{ color: "var(--primary-color)", fontSize: "1.1rem" }} />
                <span style={{ color: "var(--text-dark)" }}>Settings</span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "var(--error)",
                  transition: "background-color 0.2s ease"
                }}
                onClick={onLogout}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--error-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <i className="fas fa-sign-out-alt" />
                <span>Logout</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--white)",
              padding: "2rem",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              maxWidth: "400px",
              width: "90%",
            }}
          >
            <h3
              style={{
                color: "var(--text-dark)",
                marginBottom: "1rem",
              }}
            >
              Delete File
            </h3>
            <p
              style={{
                color: "var(--text-dark)",
                marginBottom: "1.5rem",
              }}
            >
              Are you sure you want to delete "{fileToDelete?.filename}"? This
              action cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--white)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  color: "var(--text-dark)",
                  transition: "all 0.2s ease",
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
                  transition: "all 0.2s ease",
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