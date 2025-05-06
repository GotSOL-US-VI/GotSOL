'use client';

import { useEffect, useState } from 'react';

/**
 * A simple hook to handle component mounted state
 * Useful for preventing hydration mismatches
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
} 