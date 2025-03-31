import React, { useEffect, useState } from 'react';
import '../styles/ThemeToggle.css';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
      <div className="theme-toggle-inner">
        <div className="sun-icon">
          <div className="sun-rays"></div>
        </div>
        <div className="moon-icon">
          <div className="moon-crater"></div>
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle; 