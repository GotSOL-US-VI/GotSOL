"use client";

import { usePathname } from 'next/navigation';

export function ExplorerLink() {
  const pathname = usePathname();
  
  // Extract merchant ID from the URL
  const merchantMatch = pathname.match(/\/merchant\/dashboard\/([^/]+)/);
  if (!merchantMatch) {
    return null;
  }

  const merchantId = merchantMatch[1];
  const solscanUrl = `https://solscan.io/account/${merchantId}?cluster=devnet`;

  return (
    <a 
      href={solscanUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-mint transition-colors"
    >
      Merchant Transaction History
    </a>
  );
} 