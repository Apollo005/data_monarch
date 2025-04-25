import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../config';
import '../styles/global.css';
import './AIDataAnalyst.css';

const AIDataAnalyst = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [outputFormat, setOutputFormat] = useState('paragraph'); // 'paragraph' or 'bullet'
  const [analysisType, setAnalysisType] = useState('general'); // 'general', 'summary', 'report'

  useEffect(() => {
    // Get the current file from location state
    if (location.state?.currentFile) {
      setCurrentFile(location.state.currentFile);
      // Add initial context message
      setMessages([{
        type: 'system',
        content: `I'm analyzing the data from "${location.state.currentFile.filename}". What would you like to know?`,
        timestamp: new Date().toISOString()
      }]);
    }
  }, [location]);

  useEffect(() => {
    // Scroll to bottom when messages update
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const formatResponse = (content) => {
    // Check if content contains code blocks
    if (content.includes('```')) {
      return content.split('```').map((part, index) => {
        if (index % 2 === 1) {
          // This is a code block
          return (
            <pre key={index} className="code-block">
              <code>{part}</code>
            </pre>
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
      <div className="ai-header">
        <div className="ai-header-left">
          <button 
            className="back-button" 
            onClick={() => navigate('/dashboard')}
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1>AI Data Analyst <span className="pro-badge">PRO</span></h1>
        </div>
        {currentFile && (
          <div className="current-file">
            <i className="fas fa-table"></i>
            {currentFile.filename}
          </div>
        )}
      </div>

      <div className="chat-interface">
        <div className="analysis-controls">
          <div className="format-selector">
            <label>Output Format:</label>
            <select 
              value={outputFormat} 
              onChange={(e) => setOutputFormat(e.target.value)}
              className="format-select"
            >
              <option value="paragraph">Paragraph</option>
              <option value="bullet">Bullet Points</option>
            </select>
          </div>
          <div className="analysis-type-selector">
            <label>Analysis Type:</label>
            <select 
              value={analysisType} 
              onChange={(e) => setAnalysisType(e.target.value)}
              className="analysis-type-select"
            >
              <option value="general">General Analysis</option>
              <option value="summary">Summary</option>
              <option value="report">Detailed Report</option>
            </select>
          </div>
        </div>

        <div className="chat-container" ref={chatContainerRef}>
          {!currentFile && (
            <div className="welcome-message">
              <div className="welcome-header">
                <i className="fas fa-robot"></i>
                <h2>AI Data Analyst Pro</h2>
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
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={currentFile ? "Ask me anything about your data..." : "Select a file to start analysis"}
            rows={1}
            disabled={!currentFile}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !currentFile}
            className="send-button"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIDataAnalyst; 