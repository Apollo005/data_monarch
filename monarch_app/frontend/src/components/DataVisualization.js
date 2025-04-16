import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { analyzeData } from '../utils/analysis';
import './DataVisualization.css';

const DataVisualization = ({ data }) => {
  const [analysis, setAnalysis] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState({ x: '', y: '' });
  const [chartType, setChartType] = useState('scatter');
  const [plotData, setPlotData] = useState(null);

  useEffect(() => {
    if (data && data.length > 0) {
      const initialAnalysis = analyzeData(data);
      setAnalysis(initialAnalysis);
    }
  }, [data]);

  useEffect(() => {
    if (selectedColumns.x && selectedColumns.y) {
      const xData = data.map(row => row[selectedColumns.x]);
      const yData = data.map(row => row[selectedColumns.y]);
      
      const isXNumeric = !isNaN(xData[0]);
      const isYNumeric = !isNaN(yData[0]);

      let newPlotData;
      if (chartType === 'scatter' && isXNumeric && isYNumeric) {
        newPlotData = {
          type: 'scatter',
          mode: 'markers',
          x: xData,
          y: yData,
          marker: {
            color: 'var(--primary-color)',
            size: 10
          }
        };
      } else if (chartType === 'bar' && !isYNumeric) {
        const counts = {};
        yData.forEach(value => {
          counts[value] = (counts[value] || 0) + 1;
        });
        newPlotData = {
          type: 'bar',
          x: Object.keys(counts),
          y: Object.values(counts),
          marker: {
            color: 'var(--primary-color)'
          }
        };
      } else if (chartType === 'line' && isXNumeric && isYNumeric) {
        newPlotData = {
          type: 'scatter',
          mode: 'lines',
          x: xData,
          y: yData,
          line: {
            color: 'var(--primary-color)',
            width: 2
          }
        };
      } else if (chartType === 'pie' && !isYNumeric) {
        const counts = {};
        yData.forEach(value => {
          counts[value] = (counts[value] || 0) + 1;
        });
        newPlotData = {
          type: 'pie',
          labels: Object.keys(counts),
          values: Object.values(counts),
          marker: {
            colors: ['var(--primary-color)', 'var(--primary-light)', 'var(--primary-dark)']
          }
        };
      }

      setPlotData(newPlotData);
    }
  }, [selectedColumns, chartType, data]);

  if (!data || data.length === 0) {
    return (
      <div className="visualization-container">
        <div className="empty-state">
          <i className="fas fa-chart-bar"></i>
          <p>Upload data to begin visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="visualization-container">
      <div className="visualization-header">
        <h2>Data Visualization</h2>
        <div className="controls">
          <div className="column-selectors">
            <select
              value={selectedColumns.x}
              onChange={(e) => setSelectedColumns({ ...selectedColumns, x: e.target.value })}
              className="column-dropdown"
            >
              <option value="">Select X-axis</option>
              {Object.keys(data[0]).map((column) => (
                <option key={`x-${column}`} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <select
              value={selectedColumns.y}
              onChange={(e) => setSelectedColumns({ ...selectedColumns, y: e.target.value })}
              className="column-dropdown"
            >
              <option value="">Select Y-axis</option>
              {Object.keys(data[0]).map((column) => (
                <option key={`y-${column}`} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
          <div className="chart-type-selector">
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="chart-type-dropdown"
            >
              <option value="scatter">Scatter Plot</option>
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>
        </div>
      </div>

      <div className="plot-container">
        {plotData ? (
          <Plot
            data={[plotData]}
            layout={{
              title: `${selectedColumns.x} vs ${selectedColumns.y}`,
              paper_bgcolor: 'var(--card-bg)',
              plot_bgcolor: 'var(--card-bg)',
              font: {
                color: 'var(--text-dark)'
              },
              xaxis: {
                title: selectedColumns.x,
                gridcolor: 'var(--border-color)'
              },
              yaxis: {
                title: selectedColumns.y,
                gridcolor: 'var(--border-color)'
              }
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['lasso2d', 'select2d'],
              displaylogo: false
            }}
            style={{ width: '100%', height: '500px' }}
          />
        ) : (
          <div className="plot-placeholder">
            <i className="fas fa-chart-line"></i>
            <p>Select columns to visualize</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataVisualization; 