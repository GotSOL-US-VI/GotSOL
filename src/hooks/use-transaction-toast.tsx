'use client';

import toast from 'react-hot-toast';

/**
 * Hook to provide a consistent transaction toast notification
 */
export function useTransactionToast() {
  return (signature: string, solscanLink?: string) => {
    toast.success(
      <div className={'text-center'}>
        <div className="text-lg">Transaction sent</div>
        {solscanLink ? (
          <a 
            href={solscanLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-xs btn-primary mt-2"
          >
            View on Solscan
          </a>
        ) : (
          <a 
            href={`https://solscan.io/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-xs btn-primary mt-2"
          >
            View Transaction
          </a>
        )}
      </div>,
    )
  }
} 