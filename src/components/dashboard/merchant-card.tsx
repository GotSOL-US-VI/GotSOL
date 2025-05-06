'use client';

import { Merchant } from '@/hooks/find-merchants';

export function MerchantCard({ merchant }: { merchant: Merchant }) {
  return (
    <div className="card hover:border-mint/50 transition-colors">
      <div className="card-body">
        <h2 className="card-title text-mint">{merchant.account.entityName}</h2>
        <p className="text-sm opacity-60">
          {merchant.publicKey.toString().slice(0, 4)}...{merchant.publicKey.toString().slice(-4)}
        </p>
        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary gap-2"
            onClick={() => window.location.href = `/merchant/dashboard/${merchant.publicKey.toString()}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Enter Point of Sale
          </button>
        </div>
      </div>
    </div>
  );
} 