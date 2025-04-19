'use client';

import { useEffect, useState } from 'react';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return a consistent structure regardless of mounted state
  // This prevents hydration mismatches
  return (
    <div className="h-full">
      {mounted ? children : null}
    </div>
  );
} 