'use client';

import { useEffect, useState } from 'react';
import { useMounted } from './use-mounted';

interface UseThemeReturn {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

/**
 * Hook to manage theme state with localStorage persistence
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');
  const mounted = useMounted();

  // Initialize theme from localStorage on mount
  useEffect(() => {
    if (!mounted) return;
    
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, [mounted]);

  // Function to toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Function to set theme with persistence
  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return { theme, toggleTheme, setTheme };
} 