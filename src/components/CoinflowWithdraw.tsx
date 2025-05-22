import { useCoinflowWithdraw } from '@/hooks/useCoinflowWithdraw';
import { useState } from 'react';

export const CoinflowWithdraw = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { initiateWithdraw, isWalletConnected, environment } = useCoinflowWithdraw({
    onSuccess: () => {
      setIsLoading(false);
      setError(null);
    },
    onError: (err) => {
      setIsLoading(false);
      setError(err.message);
    },
  });

  const handleWithdraw = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initiateWithdraw();
    } catch (err) {
      // Error is handled in the hook's onError callback
    }
  };

  return (
    <div className="p-6 flex items-center justify-between">
      <div>
        <h3 className="text-xl font-semibold">Coinflow</h3>
        <p className="text-sm opacity-70 mt-1">
          Fast and secure USDC to USD withdrawals for US customers
          {environment === 'sandbox' && (
            <span className="ml-2 text-warning">(Test Mode)</span>
          )}
        </p>
        {error && (
          <p className="text-error text-sm mt-2">{error}</p>
        )}
      </div>
      <button
        className="btn btn-primary"
        onClick={handleWithdraw}
        disabled={!isWalletConnected || isLoading}
      >
        {isLoading ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : !isWalletConnected ? (
          'Connect Wallet'
        ) : (
          'Withdraw with Coinflow'
        )}
      </button>
    </div>
  );
}; 