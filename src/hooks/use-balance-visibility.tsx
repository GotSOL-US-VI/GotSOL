import { useState, useEffect, useCallback } from 'react';

const BALANCE_VISIBILITY_KEY = 'gotsol-balance-visibility';

export function useBalanceVisibility() {
  const [isBalancesVisible, setIsBalancesVisible] = useState<boolean>(true);

  // Initialize state from localStorage on mount
  useEffect(() => {
    try {
      const savedVisibility = localStorage.getItem(BALANCE_VISIBILITY_KEY);
      if (savedVisibility !== null) {
        setIsBalancesVisible(JSON.parse(savedVisibility));
      }
    } catch (error) {
      console.warn('Failed to read balance visibility from localStorage:', error);
      // Fallback to default (true)
      setIsBalancesVisible(true);
    }
  }, []);

  // Toggle function that updates both state and localStorage
  const toggleBalanceVisibility = useCallback(() => {
    setIsBalancesVisible(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(BALANCE_VISIBILITY_KEY, JSON.stringify(newValue));
      } catch (error) {
        console.warn('Failed to save balance visibility to localStorage:', error);
      }
      return newValue;
    });
  }, []);

  return {
    isBalancesVisible,
    toggleBalanceVisibility
  };
} 