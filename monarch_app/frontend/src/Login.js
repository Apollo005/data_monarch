import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import config from './config';
import './styles/global.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there's a token in localStorage on component mount
    const token = localStorage.getItem("token");
    if (token) {
      onLogin(token);
      navigate('/dashboard');
    }
  }, [onLogin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const res = await fetch(`${config.baseUrl}/api/auth/login`, {
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
        navigate('/dashboard');
      } else {
        setMessage("Login failed: " + data.detail);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error logging in");
    }
  };

  return (
    <div className="container" style={{ 
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div className="card" style={{
        width: "100%",
        maxWidth: "400px",
        textAlign: "center"
      }}>
        <h1 style={{ 
          color: "var(--primary-color)",
          marginBottom: "2rem",
          fontSize: "2rem"
        }}>
          Data Monarch
        </h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ textAlign: "left" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "0.5rem",
              color: "var(--text-dark)",
              fontWeight: "500"
            }}>
              Username
            </label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div style={{ textAlign: "left" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "0.5rem",
              color: "var(--text-dark)",
              fontWeight: "500"
            }}>
              Password
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
          >
            Login
          </button>
        </form>
        {message && (
          <p style={{ 
            color: message.includes("failed") ? "var(--error)" : "var(--success)",
            marginTop: "1rem",
            fontWeight: "500"
          }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;