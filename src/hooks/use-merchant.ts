'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useMounted } from './use-mounted';
import { useQueryClient } from '@tanstack/react-query';

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
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const queryClient = useQueryClient();

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

  // Handle logo click to clear merchant state and redirect to home
  const handleLogoClick = () => {
    setActiveMerchant(null);
    
    // Invalidate merchants cache to ensure fresh data when navigating home
    queryClient.invalidateQueries({ 
      queryKey: ['merchants'] 
    });
    
    router.push('/');
  };

  return { activeMerchant, setActiveMerchant, handleLogoClick };
} 