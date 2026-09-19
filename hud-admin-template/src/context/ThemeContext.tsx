import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeContextProps {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored ? stored === 'dark' : true; // default dark
  });

  useEffect(() => {
  const className = 'dark';
  const root = document.documentElement; // apply to <html>
  if (isDark) {
    root.classList.add(className);
  } else {
    root.classList.remove(className);
  }
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  console.log('Theme changed:', isDark ? 'dark' : 'light');
}, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
