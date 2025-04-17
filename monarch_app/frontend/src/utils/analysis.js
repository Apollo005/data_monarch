export const analyzeData = (data) => {
  if (!data || data.length === 0) return null;

  const columnTypes = {};
  const uniqueValues = {};
  const numericStats = {};
  let numericColumns = 0;
  let categoricalColumns = 0;

  // Check if data has valid structure
  if (!data[0] || typeof data[0] !== 'object') {
    return {
      totalRecords: data.length,
      numericColumns: 0,
      categoricalColumns: 0,
      columnTypes: {},
      uniqueValues: {},
      numericStats: {}
    };
  }

  // Get all columns from the first row
  const columns = Object.keys(data[0]);
  
  // Process each column separately to avoid memory issues
  columns.forEach(column => {
    // Skip if column is undefined or null
    if (!column) return;
    
    // Initialize column stats
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    const uniqueSet = new Set();
    let isNumeric = false;
    let firstValidValue = null;
    
    // Process data in batches to avoid stack overflow
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const end = Math.min(i + batchSize, data.length);
      
      for (let j = i; j < end; j++) {
        const row = data[j];
        if (!row) continue;
        
        const value = row[column];
        
        // Skip null/undefined values
        if (value === null || value === undefined) continue;
        
        // Add to unique values set
        uniqueSet.add(value);
        
        // Check if numeric (only on first valid value)
        if (firstValidValue === null) {
          firstValidValue = value;
          isNumeric = !isNaN(value);
        }
        
        // Process numeric values
        if (isNumeric) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            sum += numValue;
            count++;
            min = Math.min(min, numValue);
            max = Math.max(max, numValue);
          }
        }
      }
    }
    
    // Determine column type
    columnTypes[column] = isNumeric ? 'numeric' : 'categorical';
    uniqueValues[column] = uniqueSet.size;
    
    if (isNumeric) {
      numericColumns++;
      
      // Calculate numeric stats if we have valid values
      if (count > 0) {
        const mean = sum / count;
        
        // Calculate standard deviation in a separate pass to avoid memory issues
        let sumSquaredDiff = 0;
        for (let i = 0; i < data.length; i += batchSize) {
          const end = Math.min(i + batchSize, data.length);
          
          for (let j = i; j < end; j++) {
            const row = data[j];
            if (!row) continue;
            
            const value = row[column];
            if (value === null || value === undefined) continue;
            
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              sumSquaredDiff += Math.pow(numValue - mean, 2);
            }
          }
        }
        
        const variance = sumSquaredDiff / count;
        const stdDev = Math.sqrt(variance);
        
        // Calculate median using a more efficient approach for large datasets
        // For very large datasets, we'll use an approximation
        let median;
        if (data.length > 10000) {
          // For very large datasets, use a sampling approach
          const sampleSize = Math.min(10000, data.length);
          const sample = [];
          const step = Math.floor(data.length / sampleSize);
          
          for (let i = 0; i < data.length; i += step) {
            const row = data[i];
            if (!row) continue;
            
            const value = row[column];
            if (value === null || value === undefined) continue;
            
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              sample.push(numValue);
            }
          }
          
          if (sample.length > 0) {
            sample.sort((a, b) => a - b);
            const middle = Math.floor(sample.length / 2);
            median = sample.length % 2 === 0
              ? (sample[middle - 1] + sample[middle]) / 2
              : sample[middle];
          } else {
            median = 'N/A';
          }
        } else {
          // For smaller datasets, calculate the actual median
          const numericValues = [];
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            
            const value = row[column];
            if (value === null || value === undefined) continue;
            
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              numericValues.push(numValue);
            }
          }
          
          if (numericValues.length > 0) {
            numericValues.sort((a, b) => a - b);
            const middle = Math.floor(numericValues.length / 2);
            median = numericValues.length % 2 === 0
              ? (numericValues[middle - 1] + numericValues[middle]) / 2
              : numericValues[middle];
          } else {
            median = 'N/A';
          }
        }
        
        numericStats[column] = {
          mean,
          median,
          min: min === Infinity ? 'N/A' : min,
          max: max === -Infinity ? 'N/A' : max,
          stdDev
        };
      } else {
        numericStats[column] = {
          mean: 'N/A',
          median: 'N/A',
          min: 'N/A',
          max: 'N/A',
          stdDev: 'N/A'
        };
      }
    } else {
      categoricalColumns++;
    }
  });

  return {
    totalRecords: data.length,
    numericColumns,
    categoricalColumns,
    columnTypes,
    uniqueValues,
    numericStats
  };
};

// These helper functions are no longer used directly in the main function
// but kept for reference or potential use elsewhere
const calculateMean = (values) => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calculateMedian = (values) => {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const calculateStandardDeviation = (values) => {
  if (!values || values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}; 