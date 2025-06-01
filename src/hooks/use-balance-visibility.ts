import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * useBalanceVisibility
 * Persists a global balance visibility toggle in localStorage that applies to all merchants.
 * @param merchantPubkey - The merchant's public key (string or PublicKey) - kept for API compatibility
 * @returns [isVisible, setIsVisible]
 */
export function useBalanceVisibility(merchantPubkey: string | { toString(): string }): [boolean, Dispatch<SetStateAction<boolean>>] {
  // Use a global key for all merchants
  const key = 'merchant-balance-visibility-global';
  
  const getInitial = () => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(key);
    return stored === null ? true : stored === 'true';
  };

  const [isVisible, setIsVisible] = useState<boolean>(getInitial);

  useEffect(() => {
    localStorage.setItem(key, String(isVisible));
  }, [isVisible, key]);

  return [isVisible, setIsVisible];
} 