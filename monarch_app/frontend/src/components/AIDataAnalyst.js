import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../config';
import '../styles/global.css';
import './AIDataAnalyst.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Plot from 'react-plotly.js';
import axios from 'axios';

const TypeWriter = ({ text, speed = 10 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
    }
  }, [currentIndex, text, speed]);

  return (
    <div className={`typewriter-text ${isComplete ? 'complete' : ''}`}>
      {displayedText}
      {!isComplete && <span className="cursor"></span>}
    </div>
  );
};

const AIDataAnalyst = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [outputFormat, setOutputFormat] = useState('paragraph');
  const [analysisType, setAnalysisType] = useState('general');
  const [executedPlots, setExecutedPlots] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    // Get username from JWT token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        setUsername(tokenPayload.sub);
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (location.state?.currentFile) {
      setCurrentFile(location.state.currentFile);
      setMessages([]);
      setExecutedPlots({});
      setMessages([{
        type: 'system',
        content: `I'm analyzing the data from "${location.state.currentFile.filename}". What would you like to know?`,
        timestamp: new Date().toISOString()
      }]);
    }
  }, [location.state?.currentFile]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLogout = () => {
    onLogout();
    setShowUserMenu(false);
    navigate('/login');
  };

  const handleSettings = () => {
    setShowUserMenu(false);
    console.log("Settings clicked");
  };

  const handleProfile = () => {
    setShowUserMenu(false);
    console.log("Profile clicked");
  };

  const formatResponse = (content) => {
    if (content.includes('```')) {
      return content.split('```').map((part, index) => {
        if (index % 2 === 1) {
          const [language, ...codeLines] = part.split('\n');
          const code = codeLines.join('\n').trim();
          
          return (
            <div key={index} className="code-block-container">
              <div className="code-block">
                <div className="code-header">
                  <span className="code-language">{language.trim()}</span>
                  <button 
                    className="run-code-button"
                    onClick={() => executeCode(code, index)}
                  >
                    <i className="fas fa-play"></i>
                    Run Code
                  </button>
                </div>
                <SyntaxHighlighter language="python" style={vscDarkPlus}>
                  {code}
                </SyntaxHighlighter>
              </div>
              {executedPlots[index] && (
                <div className="plot-container">
                  <div className="plot-content">
                    <img 
                      src={`data:image/png;base64,${executedPlots[index].data}`}
                      alt="Generated plot"
                      style={{ width: '100%', height: 'auto', maxHeight: '500px', borderRadius: '8px' }}
                    />
                    <div className="plot-controls">
                      <button 
                        className="plot-control-button" 
                        title="Download Plot"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `data:image/png;base64,${executedPlots[index].data}`;
                          link.download = `plot_${new Date().getTime()}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        <i className="fas fa-download"></i>
                      </button>
                      <button 
                        className="plot-control-button" 
                        title="Enlarge Plot"
                        onClick={() => {
                          const modal = document.createElement('div');
                          modal.className = 'plot-modal';
                          modal.innerHTML = `
                            <div class="plot-modal-content">
                              <div class="plot-modal-header">
                                <span>Plot Preview</span>
                                <button class="plot-modal-close">
                                  <i class="fas fa-times"></i>
                                </button>
                              </div>
                              <div class="plot-modal-body">
                                <img 
                                  src="data:image/png;base64,${executedPlots[index].data}"
                                  alt="Enlarged plot"
                                  style="width: 100%; height: auto; max-height: 80vh;"
                                />
                              </div>
                            </div>
                          `;
                          document.body.appendChild(modal);
                          
                          const closeButton = modal.querySelector('.plot-modal-close');
                          closeButton.onclick = () => {
                            document.body.removeChild(modal);
                          };
                          
                          modal.onclick = (e) => {
                            if (e.target === modal) {
                              document.body.removeChild(modal);
                            }
                          };
                        }}
                      >
                        <i className="fas fa-expand"></i>
                      </button>
                    </div>
                  </div>
                  {executedPlots[index].text && (
                    <div className="code-output">
                      <div className="output-header">
                        <i className="fas fa-terminal"></i>
                        Output
                      </div>
                      <pre>{executedPlots[index].text}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }
        return <TypeWriter key={index} text={part} />;
      });
    }
    return <TypeWriter text={content} />;
  };

  const executeCode = async (code, index) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${config.baseUrl}/api/ai/execute-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          code,
          fileId: currentFile?.id,
          data: window.currentAnalysisData // Pass the stored data
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to execute code');
      }

      const data = await response.json();
      if (data.type === "plot") {
        setExecutedPlots(prev => ({
          ...prev,
          [index]: data
        }));
      } else if (data.type === "text") {
        setMessages(prev => [...prev, {
          type: 'system',
          content: data.result,
          timestamp: new Date().toISOString()
        }]);
      } else if (data.type === "error") {
        setMessages(prev => [...prev, {
          type: 'error',
          content: `Error executing code: ${data.error}\n${data.trace || ''}`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error executing code:', error);
      setMessages(prev => [...prev, {
        type: 'error',
        content: `Error executing code: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleStopAnalysis = () => {
    setIsAnalyzing(false);
    setIsLoading(false);
    setMessages(prev => [...prev, {
      type: 'system',
      content: 'Analysis stopped by user.',
      timestamp: new Date().toISOString()
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.baseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          query: inputMessage,
          fileId: currentFile?.id,
          format: outputFormat,
          analysisType: analysisType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      // Create AI message with file info if available
      const aiMessage = {
        type: 'ai',
        content: data.response,
        timestamp: new Date().toISOString(),
        fileInfo: data.file_info // Add file info to message
      };

      setMessages(prev => [...prev, aiMessage]);

      // Store the data for use in code execution
      if (data.data) {
        window.currentAnalysisData = data.data;
      }

      // Automatically execute any code blocks in the response
      const codeBlocks = data.response.match(/```[\s\S]*?```/g) || [];
      for (let i = 0; i < codeBlocks.length; i++) {
        if (!isAnalyzing) break; // Stop if analysis was cancelled
        
        const codeBlock = codeBlocks[i];
        const [language, ...codeLines] = codeBlock.replace(/```/g, '').split('\n');
        const code = codeLines.join('\n').trim();
        
        if (language.trim() === 'plot' || language.trim() === 'python') {
          await executeCode(code, i);
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = {
        type: 'error',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Add these styles
  const styles = `
    .chat-interface {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 64px);
      background: var(--background-light);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .chat-container {
      flex-grow: 1;
      overflow-y: auto;
      padding: 2rem;
      scroll-behavior: smooth;
    }

    .message {
      margin-bottom: 2rem;
      opacity: 0;
      transform: translateY(20px);
      animation: messageSlideIn 0.3s ease forwards;
    }

    @keyframes messageSlideIn {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-content {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .ai-avatar, .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ai-avatar {
      background: var(--primary-color);
      color: var(--white);
    }

    .user-avatar {
      background: var(--background-dark);
      color: var(--white);
    }

    .message-text {
      flex-grow: 1;
      background: var(--card-bg);
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      font-size: 0.95rem;
      line-height: 1.6;
    }

    .user .message-text {
      background: var(--primary-color);
      color: var(--white);
    }

    .message-timestamp {
      font-size: 0.75rem;
      color: var(--text-light);
      margin-top: 0.5rem;
      text-align: right;
    }

    .input-container {
      padding: 1.5rem;
      background: var(--card-bg);
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 1rem;
      align-items: flex-end;
    }

    .chat-input {
      flex-grow: 1;
      padding: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--background-light);
      resize: none;
      min-height: 60px;
      max-height: 150px;
      font-size: 0.95rem;
      line-height: 1.5;
      transition: all 0.2s ease;
    }

    .chat-input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px var(--primary-color-light);
    }

    .send-button, .stop-button {
      padding: 1rem;
      border: none;
      border-radius: 8px;
      background: var(--primary-color);
      color: var(--white);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }

    .stop-button {
      background: var(--error);
    }

    .send-button:hover {
      background: var(--primary-color-dark);
      transform: translateY(-2px);
    }

    .stop-button:hover {
      background: var(--error-dark);
      transform: translateY(-2px);
    }

    .typewriter-text {
      position: relative;
      white-space: pre-wrap;
    }

    .cursor {
      display: inline-block;
      width: 2px;
      height: 1.2em;
      background: currentColor;
      margin-left: 2px;
      animation: cursor-blink 1s step-end infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    .code-block-container {
      margin: 1.5rem 0;
      opacity: 0;
      transform: translateY(10px);
      animation: codeBlockSlideIn 0.3s ease forwards;
    }

    @keyframes codeBlockSlideIn {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .welcome-message {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-light);
    }

    .welcome-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .welcome-header i {
      font-size: 3rem;
      color: var(--primary-color);
    }

    .welcome-header h2 {
      font-size: 1.5rem;
      color: var(--text-dark);
      margin: 0;
    }

    .return-button {
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background: var(--primary-color);
      color: var(--white);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .return-button:hover {
      background: var(--primary-color-dark);
      transform: translateY(-2px);
    }
  `;

  // Add the styles to the document
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div className="ai-analyst-new">
      <div className="ai-sidebar">
        <div className="sidebar-content">
          <button className="sidebar-button">
            <i className="fas fa-file-alt"></i>
            <span>Documents</span>
          </button>
          <button className="sidebar-button">
            <i className="fas fa-history"></i>
            <span>History</span>
          </button>
          <button className="sidebar-button">
            <i className="fas fa-ellipsis-h"></i>
            <span>Other</span>
          </button>
        </div>
        {/* User Section */}
        <div className="sidebar-user-section">
          <button
            className="user-profile-trigger"
            onClick={() => setShowUserMenu(!showUserMenu)}
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
              
              <div style={{ height: "1px", background: "var(--border-color)", margin: "0.5rem 0" }}></div>
              
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
      </div>

      <div className="ai-main-content">
        <div className="ai-header">
          <div className="ai-header-left">
            <button 
              className="back-button" 
              onClick={() => navigate('/dashboard')}
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1>ENVER<span className="pro-badge">PRO</span></h1>
          </div>
          <div className="ai-header-right">
            {currentFile && (
              <div className="current-file">
                <i className="fas fa-table"></i>
                {currentFile.filename}
              </div>
            )}
          </div>
        </div>

        <div className="chat-interface">
          <div className="chat-container" ref={chatContainerRef}>
            {!currentFile && (
              <div className="welcome-message">
                <div className="welcome-header">
                  <i className="fas fa-robot"></i>
                  <h2>Enver AI</h2>
                </div>
                <p>Please select a file from the dashboard to begin analysis.</p>
                <button 
                  className="return-button"
                  onClick={() => navigate('/dashboard')}
                >
                  Return to Dashboard
                </button>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.type}`}
              >
                <div className="message-content">
                  {message.type === 'ai' && (
                    <div className="ai-avatar">
                      <i className="fas fa-robot"></i>
                    </div>
                  )}
                  <div className="message-text">
                    {formatResponse(message.content)}
                  </div>
                  {message.type === 'user' && (
                    <div className="user-avatar">
                      <i className="fas fa-user"></i>
                    </div>
                  )}
                </div>
                <div className="message-timestamp">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message ai loading">
                <div className="message-content">
                  <div className="ai-avatar">
                    <i className="fas fa-robot"></i>
                  </div>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="input-container">
            <div className="input-controls">
              <div className="format-dropdown">
                <button 
                  className="control-button"
                  onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                  title="Output Format"
                >
                  <i className="fas fa-paragraph"></i>
                </button>
                {showFormatDropdown && (
                  <div className="dropdown-menu">
                    <button 
                      className={`dropdown-item ${outputFormat === 'paragraph' ? 'active' : ''}`}
                      onClick={() => {
                        setOutputFormat('paragraph');
                        setShowFormatDropdown(false);
                      }}
                    >
                      <i className="fas fa-paragraph"></i>
                      Paragraph
                    </button>
                    <button 
                      className={`dropdown-item ${outputFormat === 'bullet' ? 'active' : ''}`}
                      onClick={() => {
                        setOutputFormat('bullet');
                        setShowFormatDropdown(false);
                      }}
                    >
                      <i className="fas fa-list-ul"></i>
                      Bullet Points
                    </button>
                  </div>
                )}
              </div>
              <div className="analysis-dropdown">
                <button 
                  className="control-button"
                  onClick={() => setShowAnalysisDropdown(!showAnalysisDropdown)}
                  title="Analysis Type"
                >
                  <i className="fas fa-chart-line"></i>
                </button>
                {showAnalysisDropdown && (
                  <div className="dropdown-menu">
                    <button 
                      className={`dropdown-item ${analysisType === 'general' ? 'active' : ''}`}
                      onClick={() => {
                        setAnalysisType('general');
                        setShowAnalysisDropdown(false);
                      }}
                    >
                      <i className="fas fa-chart-line"></i>
                      General Analysis
                    </button>
                    <button 
                      className={`dropdown-item ${analysisType === 'summary' ? 'active' : ''}`}
                      onClick={() => {
                        setAnalysisType('summary');
                        setShowAnalysisDropdown(false);
                      }}
                    >
                      <i className="fas fa-file-alt"></i>
                      Summary
                    </button>
                    <button 
                      className={`dropdown-item ${analysisType === 'report' ? 'active' : ''}`}
                      onClick={() => {
                        setAnalysisType('report');
                        setShowAnalysisDropdown(false);
                      }}
                    >
                      <i className="fas fa-file-medical"></i>
                      Detailed Report
                    </button>
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={currentFile ? "Ask me anything about your data..." : "Select a file to start analysis"}
              rows={1}
              disabled={!currentFile || isLoading}
              className="chat-input"
            />
            {isLoading ? (
              <button 
                onClick={handleStopAnalysis}
                className="stop-button"
                title="Stop Analysis"
              >
                <i className="fas fa-stop"></i>
              </button>
            ) : (
              <button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || !currentFile}
                className="send-button"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDataAnalyst; 