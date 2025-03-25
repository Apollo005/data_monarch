import React from "react";
import FileUpload from "./FileUpload";
import Login from "./Login";

function App() {
  return (
    <div className="App" style={{ padding: "2rem" }}>
      <h1>Data Monarch Portal</h1>
      <Login />
      <hr />
      <FileUpload />
    </div>
  );
}

export default App;