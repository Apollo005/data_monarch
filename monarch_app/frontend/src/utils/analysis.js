export const analyzeData = (data) => {
  if (!data || data.length === 0) return null;

  const columnTypes = {};
  const uniqueValues = {};
  const numericStats = {};
  let numericColumns = 0;
  let categoricalColumns = 0;

  // Analyze each column
  Object.keys(data[0]).forEach(column => {
    const values = data.map(row => row[column]);
    const isNumeric = !isNaN(values[0]);
    
    columnTypes[column] = isNumeric ? 'numeric' : 'categorical';
    uniqueValues[column] = new Set(values).size;

    if (isNumeric) {
      numericColumns++;
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      numericStats[column] = {
        mean: calculateMean(numericValues),
        median: calculateMedian(numericValues),
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        stdDev: calculateStandardDeviation(numericValues)
      };
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

const calculateMean = (values) => {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calculateMedian = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const calculateStandardDeviation = (values) => {
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}; 