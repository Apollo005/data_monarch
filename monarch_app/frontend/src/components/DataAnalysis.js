import React, { useState, useEffect } from 'react';
import { analyzeData } from '../utils/analysis';
import './DataAnalysis.css';

const DataAnalysis = ({ data }) => {
  const [analysis, setAnalysis] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data && data.length > 0) {
      const initialAnalysis = analyzeData(data);
      setAnalysis(initialAnalysis);
    }
  }, [data]);

  const handleColumnSelect = (column) => {
    setSelectedColumn(column);
    setLoading(true);
    
    // Simulate prediction calculation
    setTimeout(() => {
      const columnData = data.map(row => row[column]);
      const isNumeric = !isNaN(columnData[0]);
      
      if (isNumeric) {
        // Generate trend predictions
        const predictions = {
          nextValue: Math.random() * 100,
          trend: 'upward',
          confidence: Math.random() * 100
        };
        setPredictions(predictions);
      } else {
        // Generate categorical predictions
        const predictions = {
          mostLikely: columnData[Math.floor(Math.random() * columnData.length)],
          probability: Math.random() * 100
        };
        setPredictions(predictions);
      }
      
      setLoading(false);
    }, 1000);
  };

  if (!data || data.length === 0) {
    return (
      <div className="analysis-container">
        <div className="empty-state">
          <i className="fas fa-chart-line"></i>
          <p>Upload data to begin analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h2>Data Analysis</h2>
        <div className="column-selector">
          <select 
            value={selectedColumn} 
            onChange={(e) => handleColumnSelect(e.target.value)}
            className="column-dropdown"
          >
            <option value="">Select a column to analyze</option>
            {Object.keys(data[0]).map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      </div>

      {analysis && (
        <div className="analysis-grid">
          <div className="analysis-card">
            <h3>Data Overview</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Records</span>
                <span className="stat-value">{analysis.totalRecords}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Numeric Columns</span>
                <span className="stat-value">{analysis.numericColumns}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Categorical Columns</span>
                <span className="stat-value">{analysis.categoricalColumns}</span>
              </div>
            </div>
          </div>

          {selectedColumn && (
            <div className="analysis-card">
              <h3>Column Analysis</h3>
              {loading ? (
                <div className="loading-spinner">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Analyzing data...</span>
                </div>
              ) : (
                <div className="column-analysis">
                  <div className="column-stats">
                    <h4>{selectedColumn}</h4>
                    <div className="stats-details">
                      <div className="stat-row">
                        <span>Type:</span>
                        <span>{analysis.columnTypes[selectedColumn]}</span>
                      </div>
                      <div className="stat-row">
                        <span>Unique Values:</span>
                        <span>{analysis.uniqueValues[selectedColumn]}</span>
                      </div>
                      {analysis.columnTypes[selectedColumn] === 'numeric' && (
                        <>
                          <div className="stat-row">
                            <span>Mean:</span>
                            <span>{analysis.numericStats[selectedColumn]?.mean.toFixed(2)}</span>
                          </div>
                          <div className="stat-row">
                            <span>Median:</span>
                            <span>{analysis.numericStats[selectedColumn]?.median.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {predictions && (
                    <div className="predictions">
                      <h4>Predictions</h4>
                      {analysis.columnTypes[selectedColumn] === 'numeric' ? (
                        <div className="prediction-details">
                          <div className="prediction-item">
                            <span>Next Value:</span>
                            <span className="prediction-value">
                              {predictions.nextValue.toFixed(2)}
                            </span>
                          </div>
                          <div className="prediction-item">
                            <span>Trend:</span>
                            <span className={`trend-indicator ${predictions.trend}`}>
                              {predictions.trend}
                            </span>
                          </div>
                          <div className="prediction-item">
                            <span>Confidence:</span>
                            <span className="confidence-value">
                              {predictions.confidence.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="prediction-details">
                          <div className="prediction-item">
                            <span>Most Likely Next Value:</span>
                            <span className="prediction-value">
                              {predictions.mostLikely}
                            </span>
                          </div>
                          <div className="prediction-item">
                            <span>Probability:</span>
                            <span className="confidence-value">
                              {predictions.probability.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataAnalysis; 