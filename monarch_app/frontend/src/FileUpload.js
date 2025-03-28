import React, { useState } from "react";
import axios from "axios";
import DataTable from "./DataTable";
import config from './config';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [fileData, setFileData] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);  //store selected file
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
      console.log(response.data);  //log server response
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
