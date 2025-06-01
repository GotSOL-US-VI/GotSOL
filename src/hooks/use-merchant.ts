'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useMounted } from './use-mounted';

interface UseMerchantReturn {
  activeMerchant: string | null;
  setActiveMerchant: (merchantId: string | null) => void;
}

/**
 * Hook to manage merchant state with localStorage persistence
 * Navigation logic is handled in client-providers.tsx
 */
export function useMerchant(): UseMerchantReturn {
  const [activeMerchant, setActiveMerchantState] = useState<string | null>(null);
  const params = useParams();
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

  // Update active merchant based on the route parameter
  useEffect(() => {
    if (!mounted) return;
    
    // Use proper path parameter extraction
    const merchantId = params?.merchantId as string;
    
    if (merchantId) {
      setActiveMerchant(merchantId);
    } else if (pathname === '/') {
      // Clear active merchant when returning to home
      setActiveMerchant(null);
    }
  }, [params, pathname, mounted]);

  // Function to set merchant with persistence
  const setActiveMerchant = (merchantId: string | null) => {
    setActiveMerchantState(merchantId);
    if (merchantId) {
      localStorage.setItem('activeMerchant', merchantId);
    } else {
      localStorage.removeItem('activeMerchant');
    }
  };

  return { activeMerchant, setActiveMerchant };
} 