import React, { useState, useEffect } from "react";
import axios from "axios";

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [fileData, setFileData] = useState(null);
  const [socket, setSocket] = useState(null);  // WebSocket connection

  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket("ws://localhost:8000/ws");
    setSocket(ws);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setFileData(data); // Update the data with real-time updates
    };

    return () => {
      ws.close();  // Cleanup when component unmounts
    };
  }, []);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage("Please select a file first!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:8000/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("Upload successful!");
      setFileData(response.data.data);
    } catch (error) {
      setMessage("Upload failed");
      console.error("Error uploading file:", error);
    }
  };

  const handleFilter = (filterParams) => {
    if (socket) {
      socket.send(JSON.stringify(filterParams));  // Send filter params through WebSocket
    }
  };

  return (
    <div className="file-upload">
      <h2>Upload a File</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      <p>{message}</p>

      {fileData && <DataTable data={fileData} />}
    </div>
  );
};

export default FileUpload;
