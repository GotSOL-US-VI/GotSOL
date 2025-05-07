"use client";

import { useParams } from 'next/navigation';

export function ExplorerLink() {
  const params = useParams();
  
  // Extract merchant ID from the route parameters
  const merchantId = params?.merchantId as string;
  
  if (!merchantId) {
    return null;
  }

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