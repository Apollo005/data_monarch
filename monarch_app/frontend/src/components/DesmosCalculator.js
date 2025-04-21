import React, { useEffect, useRef } from 'react';

const DesmosCalculator = ({ equation }) => {
  const calculatorRef = useRef(null);
  const desmosRef = useRef(null);

  useEffect(() => {
    // Load Desmos script dynamically
    const script = document.createElement('script');
    script.src = 'https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    script.async = true;
    script.onload = () => {
      // Initialize calculator after script loads
      if (calculatorRef.current && window.Desmos) {
        desmosRef.current = window.Desmos.GraphingCalculator(calculatorRef.current, {
          expressions: true, // Enable expressions panel
          settingsMenu: true,
          zoomButtons: true,
          lockViewport: false,
          border: false,
          expressionsCollapsed: false,
          backgroundColor: '#2D3748', // Match the dark theme
          textColor: '#FFFFFF', // White text
          gridColor: '#4A5568', // Subtle grid color
          labelColor: '#A0AEC0' // Subtle label color
        });

        // Set initial state
        if (equation) {
          desmosRef.current.setExpression({
            id: 'regression',
            latex: equation,
            color: '#805AD5' // Match the theme's primary color
          });

          // Set reasonable bounds for viewing
          desmosRef.current.setMathBounds({
            left: -10,
            right: 10,
            bottom: -10,
            top: 10
          });
        }
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (desmosRef.current) {
        desmosRef.current.destroy();
      }
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // Update equation when it changes
    if (desmosRef.current && equation) {
      console.log('Setting Desmos equation:', equation);
      
      // Clear previous expressions
      desmosRef.current.removeExpression({ id: 'regression' });
      
      // Add new expression
      desmosRef.current.setExpression({
        id: 'regression',
        latex: equation,
        color: '#805AD5'
      });

      // Center the graph on the equation
      desmosRef.current.setMathBounds({
        left: -10,
        right: 10,
        bottom: -10,
        top: 10
      });
    }
  }, [equation]);

  return (
    <div className="calculator-container">
      <div 
        ref={calculatorRef} 
        style={{ 
          width: '100%', 
          height: '400px',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default DesmosCalculator; 