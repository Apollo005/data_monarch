import React, { useState, useEffect } from 'react';
import { analyzeData } from '../utils/analysis';
import config from '../config';
import './DataAnalysis.css';
import DesmosCalculator from './DesmosCalculator';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const DataAnalysis = ({ data, fileId }) => {
  const [analysis, setAnalysis] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [predictions, setPredictions] = useState(null);
  const [textClusters, setTextClusters] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Regression analysis state
  const [regressionType, setRegressionType] = useState('linear');
  const [targetColumn, setTargetColumn] = useState('');
  const [featureColumns, setFeatureColumns] = useState([]);
  const [regressionResults, setRegressionResults] = useState(null);
  const [regressionLoading, setRegressionLoading] = useState(false);
  const [regressionError, setRegressionError] = useState(null);
  const [isFeatureListOpen, setIsFeatureListOpen] = useState(false);
  const [selectedFeatureForView, setSelectedFeatureForView] = useState(null);
  const [showRunButton, setShowRunButton] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [desmosEquation, setDesmosEquation] = useState('');

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Feature Importance Analysis',
        color: '#ffffff',
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: '#805AD5',
        titleColor: '#2D3748',
        bodyColor: '#ffffff',
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (tooltipItems) => tooltipItems[0].label,
          label: (context) => `Importance: ${context.raw.toFixed(4)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#ffffff',
          maxRotation: 0,
          minRotation: 0,
          font: {
            size: 11
          }
        },
        border: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: '#ffffff',
          font: {
            size: 11
          },
          callback: (value) => value.toFixed(3)
        },
        border: {
          display: false
        }
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    layout: {
      padding: {
        left: 10,
        right: 10,
        top: 0,
        bottom: 10
      }
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    }
  };

  useEffect(() => {
    if (data && data.length > 0) {
      const initialAnalysis = analyzeData(data);
      setAnalysis(initialAnalysis);
    }
  }, [data]);

  useEffect(() => {
    // Log props when they change
    console.log('DataAnalysis props:', { data: !!data, fileId });
  }, [data, fileId]);

  const handleColumnSelect = (column) => {
    setSelectedColumn(column);
    setLoading(true);
    setPredictions(null);
    setTextClusters(null);
    
    // Simulate prediction calculation
    setTimeout(() => {
      const columnData = data.map(row => row[column]);
      const isNumeric = analysis.columnTypes[column] === 'numeric';
      
      if (isNumeric) {
        // Generate regression predictions
        const predictions = generateRegressionPredictions(columnData);
        setPredictions(predictions);
      } else {
        // Generate text clustering analysis
        const clusters = generateTextClusters(columnData);
        setTextClusters(clusters);
      }
      
      setLoading(false);
    }, 1000);
  };

  // Function to generate regression predictions for numerical data
  const generateRegressionPredictions = (columnData) => {
    // Filter out non-numeric values
    const numericData = columnData.filter(value => !isNaN(value) && value !== null && value !== undefined);
    
    if (numericData.length < 2) {
      return {
        nextValue: 'N/A',
        trend: 'insufficient data',
        confidence: 0,
        regressionLine: [],
        rSquared: 0
      };
    }
    
    // Convert to numbers and sort
    const sortedData = numericData.map(Number).sort((a, b) => a - b);
    
    // Calculate min and max for scaling
    const min = Math.min(...sortedData);
    const max = Math.max(...sortedData);
    const range = max - min;
    
    // Generate x values (indices)
    const xValues = Array.from({ length: sortedData.length }, (_, i) => i);
    
    // Calculate linear regression
    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = sortedData.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * sortedData[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const totalSS = sortedData.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const residualSS = sortedData.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = 1 - (residualSS / totalSS);
    
    // Generate regression line points
    const regressionLine = xValues.map(x => ({
      x,
      y: slope * x + intercept
    }));
    
    // Predict next value
    const nextValue = slope * n + intercept;
    
    // Determine trend
    let trend = 'stable';
    if (slope > 0.05 * range) {
      trend = 'upward';
    } else if (slope < -0.05 * range) {
      trend = 'downward';
    }
    
    // Calculate confidence based on R-squared
    const confidence = Math.min(100, Math.max(0, rSquared * 100));
    
    return {
      nextValue,
      trend,
      confidence,
      regressionLine,
      rSquared
    };
  };

  // Function to generate text clusters for categorical data
  const generateTextClusters = (columnData) => {
    // Filter out null/undefined values
    const validData = columnData.filter(value => value !== null && value !== undefined);
    
    if (validData.length === 0) {
      return {
        clusters: [],
        totalClusters: 0
      };
    }
    
    // Count frequency of each value
    const frequencyMap = {};
    validData.forEach(value => {
      const strValue = String(value).toLowerCase().trim();
      frequencyMap[strValue] = (frequencyMap[strValue] || 0) + 1;
    });
    
    // Convert to array and sort by frequency
    const frequencyArray = Object.entries(frequencyMap)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    
    // Group into clusters (top 5 most frequent)
    const topClusters = frequencyArray.slice(0, 5);
    const otherCount = frequencyArray.slice(5).reduce((sum, item) => sum + item.count, 0);
    
    const clusters = [
      ...topClusters,
      ...(otherCount > 0 ? [{ value: 'Other', count: otherCount }] : [])
    ];
    
    return {
      clusters,
      totalClusters: frequencyArray.length
    };
  };

  // Handle regression type change
  const handleRegressionTypeChange = (e) => {
    setRegressionType(e.target.value);
    setRegressionResults(null);
    setRegressionError(null);
  };

  // Handle target column change
  const handleTargetColumnChange = (e) => {
    setTargetColumn(e.target.value);
    setRegressionResults(null);
    setRegressionError(null);
  };

  // Handle feature column selection
  const handleFeatureColumnToggle = (column) => {
    if (featureColumns.includes(column)) {
      setFeatureColumns(featureColumns.filter(col => col !== column));
    } else {
      setFeatureColumns([...featureColumns, column]);
    }
    setRegressionResults(null);
    setRegressionError(null);
  };

  // Update the convertToDesmos function to handle multi-dimensional data
  const convertToDesmos = (equation) => {
    if (!equation) return '';
    
    // Remove 'y = ' from the start
    let desmosEq = equation.replace(/^y\s*=\s*/, '');
    
    // Replace multiplication symbol × with *
    desmosEq = desmosEq.replace(/×/g, '*');
    
    // Replace any spaces around operators
    desmosEq = desmosEq.replace(/\s*([+\-*])\s*/g, '$1');

    // Replace variable names with x₁, x₂, etc.
    let varCounter = 1;
    const varMap = {};
    
    // Find all variable names (words not followed by a number)
    const varNames = Array.from(new Set(
      desmosEq.match(/[a-zA-Z_][a-zA-Z0-9_]*(?!\d)/g) || []
    ));
    
    // Create mapping for variable names
    varNames.forEach(varName => {
      if (varName !== 'x' && varName !== 'y') {
        varMap[varName] = `x_{${varCounter}}`;
        varCounter++;
      }
    });
    
    // Replace variable names with their Desmos counterparts
    Object.entries(varMap).forEach(([varName, desmosVar]) => {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      desmosEq = desmosEq.replace(regex, desmosVar);
    });

    // Add y= back to the equation
    desmosEq = `y=${desmosEq}`;

    console.log('Converted equation for Desmos:', desmosEq);
    return desmosEq;
  };

  // Update handleRegressionSubmit to set the Desmos equation
  const handleRegressionSubmit = async () => {
    if (!targetColumn || featureColumns.length === 0) {
      setRegressionError('Please select a target column and at least one feature column');
      return;
    }

    setRegressionLoading(true);
    setRegressionError(null);

    try {
      const token = localStorage.getItem('token');
      const requestData = {
        file_id: fileId,
        target_column: targetColumn,
        feature_columns: featureColumns,
        regression_type: regressionType,
        test_size: 0.2,
        random_state: 42
      };

      console.log('Sending regression request:', JSON.stringify(requestData, null, 2));

      const response = await fetch(`${config.baseUrl}/api/analysis/regression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to perform regression analysis');
      }

      const responseData = await response.json();
      console.log('Regression results:', responseData);

      // Validate the response data
      if (!responseData.coefficients && !responseData.equation) {
        throw new Error('Invalid regression results format - missing coefficients or equation');
      }

      setRegressionResults(responseData);
      
      // Convert and set the Desmos equation
      if (responseData.equation) {
        setDesmosEquation(convertToDesmos(responseData.equation));
      }
    } catch (error) {
      console.error('Regression error:', error);
      setRegressionError(error.message || 'An error occurred during regression analysis');
    } finally {
      setRegressionLoading(false);
    }
  };

  const toggleFeatureList = () => {
    if (isFeatureListOpen && featureColumns.length > 0) {
      setTimeout(() => setShowRunButton(true), 300);
    } else {
      setShowRunButton(false);
    }
    setIsFeatureListOpen(!isFeatureListOpen);
  };

  const handleFeatureSelect = (feature) => {
    setSelectedFeatureForView(feature);
  };

  // Reset button visibility when target column changes
  useEffect(() => {
    setShowRunButton(false);
  }, [targetColumn]);

  // Prepare chart data when regression results change
  const getChartData = () => {
    if (!regressionResults) return null;

    const sortedFeatures = Object.entries(regressionResults.feature_importance)
      .sort((a, b) => b[1] - a[1]);

    return {
      labels: sortedFeatures.map(([feature]) => feature),
      datasets: [
        {
          data: sortedFeatures.map(([, value]) => value),
          backgroundColor: '#805AD5',
          hoverBackgroundColor: '#2D3748',
          borderRadius: 6,
          maxBarThickness: 40,
          borderSkipped: false,
        },
      ],
    };
  };

  // Update the model equation display
  const renderModelEquation = () => {
    if (!regressionResults) return null;

    // If we have a pre-formatted equation, use it
    if (regressionResults.equation) {
      return (
        <div className="equation">
          {regressionResults.equation}
        </div>
      );
    }

    // Otherwise, construct the equation from coefficients
    if (regressionType === 'linear') {
      return (
        <div className="equation">
          <span>y = {regressionResults.intercept?.toFixed(4) || '0.0000'}</span>
          {Object.entries(regressionResults.coefficients || {}).map(([feature, coef]) => (
            <span key={feature}>
              {coef >= 0 ? ' + ' : ' - '}
              {Math.abs(coef).toFixed(4)} × {feature}
            </span>
          ))}
        </div>
      );
    } else {
      return (
        <div className="equation">
          <span>log(p/(1-p)) = {regressionResults.intercept?.toFixed(4) || '0.0000'}</span>
          {Object.entries(regressionResults.coefficients || {}).map(([feature, coef]) => (
            <span key={feature}>
              {coef >= 0 ? ' + ' : ' - '}
              {Math.abs(coef).toFixed(4)} × {feature}
            </span>
          ))}
        </div>
      );
    }
  };

  // Update the metrics display
  const renderMetrics = () => {
    if (!regressionResults?.metrics) return null;

    return (
      <div className="metrics-grid">
        {Object.entries(regressionResults.metrics).map(([key, value]) => (
          <div key={key} className="metric-item">
            <span className="metric-label">{key.replace(/_/g, ' ').toUpperCase()}</span>
            <span className="metric-value">
              {typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'N/A'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Effect to control toolbar visibility
  useEffect(() => {
    setShowToolbar(targetColumn && featureColumns.length > 0);
  }, [targetColumn, featureColumns]);

  // Update the calculator button click handler
  const handleCalculatorClick = () => {
    setShowCalculator(!showCalculator);
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
      {/* Add toolbar */}
      <div className={`analysis-toolbar ${showToolbar ? 'active' : ''}`}>
        <button 
          className={`toolbar-button ${!regressionResults ? 'disabled' : ''}`}
          title="Show Calculator"
          onClick={handleCalculatorClick}
          disabled={!regressionResults}
        >
          <i className="fas fa-calculator"></i>
        </button>
        <button 
          className="toolbar-button" 
          title="Export Analysis"
          onClick={() => console.log('Export clicked')}
        >
          <i className="fas fa-file-export"></i>
        </button>
        <button 
          className="toolbar-button" 
          title="Advanced Settings"
          onClick={() => console.log('Settings clicked')}
        >
          <i className="fas fa-cog"></i>
        </button>
      </div>

      <div className="analysis-header">
        <h2>Data Analysis</h2>
        <div className="analysis-tabs">
          <button 
            className={`tab-button ${regressionType === 'linear' ? 'active' : ''}`}
            onClick={() => setRegressionType('linear')}
          >
            <i className="fas fa-chart-line"></i>
            Linear Regression
          </button>
          <button 
            className={`tab-button ${regressionType === 'logistic' ? 'active' : ''}`}
            onClick={() => setRegressionType('logistic')}
          >
            <i className="fas fa-chart-bar"></i>
            Logistic Regression
          </button>
        </div>
      </div>

      <div className="analysis-grid">
        <div className="analysis-card selection-card">
          <h3>
            <i className="fas fa-columns"></i>
            Column Selection
          </h3>
          <div className="selection-form">
            <div className="form-group">
              <label>Target Column</label>
              <select 
                value={targetColumn} 
                onChange={(e) => {
                  setTargetColumn(e.target.value);
                  setFeatureColumns([]); // Reset feature columns when target changes
                  setIsFeatureListOpen(false); // Close feature list when target changes
                  setShowRunButton(false); // Hide run button when target changes
                }}
                className="analysis-select"
              >
                <option value="">Select target column</option>
                {Object.keys(data[0]).map((column) => (
                  <option key={column} value={column}>{column}</option>
                ))}
              </select>
            </div>
            
            {targetColumn && (
              <div className="form-group feature-group">
                <label>Feature Columns</label>
                <div className="feature-selector">
                  <button 
                    className="feature-toggle-button"
                    onClick={toggleFeatureList}
                  >
                    {featureColumns.length === 0 ? 'Select features' : `${featureColumns.length} columns selected`}
                    <i className={`fas fa-chevron-${isFeatureListOpen ? 'up' : 'down'}`}></i>
                  </button>
                  {isFeatureListOpen && (
                    <div className="feature-dropdown">
                      {Object.keys(data[0]).map((column) => (
                        column !== targetColumn && (
                          <div key={column} className="feature-column-item">
                            <input 
                              type="checkbox" 
                              id={`feature-${column}`}
                              checked={featureColumns.includes(column)}
                              onChange={() => {
                                if (featureColumns.includes(column)) {
                                  setFeatureColumns(featureColumns.filter(col => col !== column));
                                } else {
                                  setFeatureColumns([...featureColumns, column]);
                                }
                                setShowRunButton(false); // Hide run button when selections change
                              }}
                            />
                            <label htmlFor={`feature-${column}`}>{column}</label>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {targetColumn && featureColumns.length > 0 && !isFeatureListOpen && showRunButton && (
              <button 
                className="analysis-button"
                onClick={handleRegressionSubmit}
                disabled={regressionLoading}
              >
                {regressionLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Running Analysis...
                  </>
                ) : (
                  <>
                    <i className="fas fa-play"></i>
                    Run Analysis
                  </>
                )}
              </button>
            )}

            {regressionError && (
              <div className="error-message">
                <i className="fas fa-exclamation-circle"></i>
                {regressionError}
              </div>
            )}
          </div>
        </div>

        {regressionResults && (
          <>
            <div className="analysis-card chart-card">
              {showCalculator ? (
                <DesmosCalculator equation={desmosEquation} />
              ) : (
                <div className="chart-container">
                  <Bar options={chartOptions} data={getChartData()} />
                </div>
              )}
            </div>

            <div className="analysis-card results-card">
              <h3>
                <i className="fas fa-chart-pie"></i>
                Analysis Results
              </h3>
              
              <div className="results-grid">
                <div className="metrics-section">
                  <h4>Model Performance</h4>
                  {renderMetrics()}
                </div>

                <div className="model-equation-section">
                  <h4>Model Equation</h4>
                  <div className="model-equation">
                    {renderModelEquation()}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DataAnalysis; 