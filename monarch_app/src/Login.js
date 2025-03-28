import React, { useState, useEffect } from "react";

const Login = ({ onLogin, onLogout, isAuthenticated }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check if there's a token in localStorage on component mount
    const token = localStorage.getItem("token");
    if (token) {
      onLogin(token);
    }
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const res = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        // Store token in localStorage
        localStorage.setItem("token", data.access_token);
        onLogin(data.access_token);
        setMessage("Login successful!");
      } else {
        setMessage("Login failed: " + data.detail);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error logging in");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    onLogout();
    setMessage("Logged out successfully");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Login</h2>
      {isAuthenticated ? (
        <div>
          <p>You are logged in!</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          /><br /><br />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          /><br /><br />
          <button type="submit">Login</button>
        </form>
      )}
      <p>{message}</p>
    </div>
  );
};

export default Login;