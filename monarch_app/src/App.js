import React, { useState } from "react";
import FileUpload from "./FileUpload";
import Login from "./Login";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = (token) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <div className="App" style={{ padding: "2rem" }}>
      <h1>Data Monarch Portal</h1>
      <Login 
        onLogin={handleLogin}
        onLogout={handleLogout}
        isAuthenticated={isAuthenticated}
      />
      <hr />
      {isAuthenticated ? (
        <FileUpload />
      ) : (
        <p>Please log in to access the file upload feature.</p>
      )}
    </div>
  );
}

export default App;