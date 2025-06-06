import { useState, useEffect, useCallback } from 'react';

const BALANCE_VISIBILITY_KEY = 'gotsol-balance-visibility';

export function useBalanceVisibility() {
  const [isBalancesVisible, setIsBalancesVisible] = useState<boolean>(false); // Default to hidden

  // Initialize state from localStorage on mount
  useEffect(() => {
    try {
      const savedVisibility = localStorage.getItem(BALANCE_VISIBILITY_KEY);
      
      if (savedVisibility !== null) {
        const parsedValue = JSON.parse(savedVisibility);
        setIsBalancesVisible(parsedValue);
      } else {
        // If no saved preference, default to hidden and save this preference
        setIsBalancesVisible(false);
        localStorage.setItem(BALANCE_VISIBILITY_KEY, JSON.stringify(false));
      }
    } catch (error) {
      console.warn('Failed to read balance visibility from localStorage:', error);
      // Fallback to default (false) and save it
      setIsBalancesVisible(false);
      localStorage.setItem(BALANCE_VISIBILITY_KEY, JSON.stringify(false));
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