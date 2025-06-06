'use client';

import { Merchant } from '@/hooks/find-merchants';
import Link from 'next/link';
import { useMerchant } from '@/hooks/use-merchant';

interface MerchantCardProps {
  merchant: Merchant
  deletionMode?: boolean
  onDelete?: () => void
}

export function MerchantCard({ merchant, deletionMode = false, onDelete }: MerchantCardProps) {
  const merchantId = merchant.publicKey.toString();
  const { setActiveMerchant } = useMerchant();
  
  const handleMerchantClick = () => {
    // Set the active merchant when clicking
    setActiveMerchant(merchantId);
  };

  const handleCardClick = () => {
    if (deletionMode && onDelete) {
      onDelete();
    }
  };
  
  if (deletionMode) {
    return (
      <div 
        className="card hover:border-red-500 transition-colors merchant-card cursor-pointer border-2 border-transparent hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={handleCardClick}
      >
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-mint">{merchant.account.entityName}</h2>
            <div className="text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
          <p className="text-sm opacity-60">
            {merchantId.slice(0, 4)}...{merchantId.slice(-4)}
          </p>
          <div className="mt-4 text-center">
            <span className="text-red-500 font-medium">Click to delete</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card hover:border-mint/50 transition-colors merchant-card">
      <div className="card-body">
        <h2 className="card-title text-mint">{merchant.account.entityName}</h2>
        <p className="text-sm opacity-60">
          {merchantId.slice(0, 4)}...{merchantId.slice(-4)}
        </p>
        <div className="card-actions justify-end mt-4">
          <Link
            href={`/merchant/dashboard/${merchantId}`}
            className="btn btn-primary gap-2"
            onClick={handleMerchantClick}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Enter Point of Sale
          </Link>
        </div>
      </div>
    </div>
  );
} 