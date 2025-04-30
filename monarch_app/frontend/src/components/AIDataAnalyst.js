import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../config';
import '../styles/global.css';
import './AIDataAnalyst.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Plot from 'react-plotly.js';

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

  const formatResponse = (content) => {
    if (content.includes('```')) {
      return content.split('```').map((part, index) => {
        if (index % 2 === 1) {
          const [language, ...codeLines] = part.split('\n');
          const code = codeLines.join('\n').trim();
          
          if (language.trim() === 'plot') {
            return (
              <div key={index} className="code-block">
                <div className="code-header">
                  <span className="code-language">Python</span>
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
                {executedPlots[index] ? (
                  <div className="plot-container">
                    <div className="plot-header">
                      <span className="plot-title">Generated Plot</span>
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
                                    style="width: 100%; height: auto;"
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
                    <div className="plot-content">
                      <img 
                        src={`data:image/png;base64,${executedPlots[index].data}`}
                        alt="Generated plot"
                        style={{ width: '100%', height: 'auto', maxHeight: '500px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="plot-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Click "Run Code" to generate plot</span>
                  </div>
                )}
              </div>
            );
          }
          
          return (
            <div key={index} className="code-block">
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
              <SyntaxHighlighter language={language.trim()} style={vscDarkPlus}>
                {code}
              </SyntaxHighlighter>
              {executedPlots[index] && (
                <div className="plot-container">
                  <div className="plot-header">
                    <span className="plot-title">Generated Plot</span>
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
                                  style="width: 100%; height: auto;"
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
                  <div className="plot-content">
                    <img 
                      src={`data:image/png;base64,${executedPlots[index].data}`}
                      alt="Generated plot"
                      style={{ width: '100%', height: 'auto', maxHeight: '500px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        }
        return formatText(part);
      });
    }
    return formatText(content);
  };

  const formatText = (text) => {
    // Split by newlines and format each line
    return text.split('\n').map((line, index) => {
      // Check for bullet points
      if (line.trim().startsWith('- ')) {
        return <li key={index}>{line.substring(2)}</li>;
      }
      // Check for numbered lists
      if (/^\d+\.\s/.test(line.trim())) {
        return <li key={index}>{line.substring(line.indexOf('.') + 2)}</li>;
      }
      // Regular paragraph
      return <p key={index}>{line}</p>;
    });
  };

  const executeCode = async (code, index) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.baseUrl}/api/ai/execute-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          code,
          fileId: currentFile?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to execute code');
      }

      const data = await response.json();
      if (data.result && data.result.plot) {
        setExecutedPlots(prev => ({
          ...prev,
          [index]: data.result.plot
        }));
      } else if (data.result && data.result.text) {
        // Handle text output
        setMessages(prev => [...prev, {
          type: 'system',
          content: data.result.text,
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
      
      const aiMessage = {
        type: 'ai',
        content: data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Automatically execute any code blocks in the response
      const codeBlocks = data.response.match(/```[\s\S]*?```/g) || [];
      for (let i = 0; i < codeBlocks.length; i++) {
        if (!isAnalyzing) break; // Stop if analysis was cancelled
        
        const codeBlock = codeBlocks[i];
        const [language, ...codeLines] = codeBlock.replace(/```/g, '').split('\n');
        const code = codeLines.join('\n').trim();
        
        if (language.trim() === 'plot') {
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
            <div className="user-profile">
              <i className="fas fa-user-circle"></i>
            </div>
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