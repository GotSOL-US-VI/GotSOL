"use client";

import { usePara } from '@/components/para/para-provider';

export function ExplorerLink() {
  const { address } = usePara();
  
  if (!address) {
    return null;
  }

  const solscanUrl = `https://solscan.io/account/${address}?cluster=devnet`;

  return (
    <a 
      href={solscanUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-mint transition-colors"
    >
      Owner Transaction History
    </a>
  );
} 