import React, { useEffect, useState } from "react";
import axios from "axios";
import config from "./config";

const Sidebar = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

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

  return (
    <aside style={{ width: "250px", borderRight: "1px solid #ccc", padding: "1rem" }}>
      <h2>My Uploaded Files</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {files.length > 0 ? (
        <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
          {files.map((file) => (
            <li key={file.id} style={{ marginBottom: "0.5rem" }}>
              <strong>{file.filename}</strong>
              <br />
              <small>Uploaded: {new Date(file.created_at).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files found.</p>
      )}
    </aside>
  );
};

export default Sidebar;
