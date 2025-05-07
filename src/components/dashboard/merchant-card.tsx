'use client';

import { Merchant } from '@/hooks/find-merchants';
import Link from 'next/link';
import { useMerchant } from '@/hooks/use-merchant';

export function MerchantCard({ merchant }: { merchant: Merchant }) {
  const merchantId = merchant.publicKey.toString();
  const { setActiveMerchant } = useMerchant();
  
  const handleMerchantClick = () => {
    // Set the active merchant when clicking
    setActiveMerchant(merchantId);
  };
  
  return (
    <div className="card hover:border-mint/50 transition-colors">
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