'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMounted } from './use-mounted';

interface UseMerchantReturn {
  activeMerchant: string | null;
  setActiveMerchant: (merchantId: string | null) => void;
  handleLogoClick: () => void;
}

/**
 * Hook to manage merchant state with localStorage persistence
 */
export function useMerchant(): UseMerchantReturn {
  const [activeMerchant, setActiveMerchantState] = useState<string | null>(null);
  const pathname = usePathname();
  const mounted = useMounted();

  // Initialize from localStorage and update based on URL
  useEffect(() => {
    if (!mounted) return;

    // Check for saved merchant in localStorage
    const savedMerchant = localStorage.getItem('activeMerchant');
    if (savedMerchant) {
      setActiveMerchantState(savedMerchant);
    }
  }, [mounted]);

  // Update active merchant when entering a merchant dashboard
  useEffect(() => {
    if (!pathname || !mounted) return;
    
    const merchantMatch = pathname.match(/\/merchant\/dashboard\/([^/]+)/);
    if (merchantMatch) {
      const merchantId = merchantMatch[1];
      setActiveMerchant(merchantId);
    } else if (pathname === '/') {
      // Clear active merchant when returning to home
      setActiveMerchant(null);
    }
  }, [pathname, mounted]);

  // Function to set merchant with persistence
  const setActiveMerchant = (merchantId: string | null) => {
    setActiveMerchantState(merchantId);
    if (merchantId) {
      localStorage.setItem('activeMerchant', merchantId);
    } else {
      localStorage.removeItem('activeMerchant');
    }
  };

  // Handle logo click to clear merchant state
  const handleLogoClick = () => {
    setActiveMerchant(null);
  };

  return { activeMerchant, setActiveMerchant, handleLogoClick };
} 