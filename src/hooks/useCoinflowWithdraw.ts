import { useCallback } from 'react';
import { useWallet, useClient } from '@getpara/react-sdk';

interface UseCoinflowWithdrawProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// Validate environment variables
const COINFLOW_MERCHANT_ID = process.env.NEXT_PUBLIC_COINFLOW_MERCHANT_ID;
const COINFLOW_ENV = process.env.NEXT_PUBLIC_COINFLOW_ENV;
const COINFLOW_API_KEY = process.env.NEXT_PUBLIC_COINFLOW_API_KEY;

if (!COINFLOW_MERCHANT_ID) {
  console.warn('Coinflow merchant ID is not set. Please add NEXT_PUBLIC_COINFLOW_MERCHANT_ID to your environment variables.');
}

if (!COINFLOW_API_KEY) {
  console.warn('Coinflow API key is not set. Please add NEXT_PUBLIC_COINFLOW_API_KEY to your environment variables.');
}

export const useCoinflowWithdraw = ({ onSuccess, onError }: UseCoinflowWithdrawProps) => {
  const { data: wallet } = useWallet();
  const para = useClient();

  const initiateWithdraw = useCallback(async () => {
    if (!wallet?.address || !para) {
      throw new Error('Please connect your Para wallet first');
    }

    if (!COINFLOW_MERCHANT_ID) {
      throw new Error('Coinflow merchant ID is not configured. Please contact support.');
    }

    if (!COINFLOW_API_KEY) {
      throw new Error('Coinflow API key is not configured. Please contact support.');
    }

    try {
      // Use sandbox API endpoint for testing
      const apiUrl = COINFLOW_ENV === 'sandbox' 
        ? `https://api-sandbox.coinflow.cash/api/merchant/${COINFLOW_MERCHANT_ID}/withdraw/init`
        : `https://api.coinflow.cash/api/merchant/${COINFLOW_MERCHANT_ID}/withdraw/init`;

      // Initialize Coinflow withdrawal
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': COINFLOW_API_KEY,
        },
        body: JSON.stringify({
          merchantId: COINFLOW_MERCHANT_ID,
          walletAddress: wallet.address,
          chain: 'solana',
          token: 'USDC',
          environment: COINFLOW_ENV,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to initialize withdrawal');
      }

      const data = await response.json();
      
      // Use sandbox widget URL for testing
      const widgetUrl = COINFLOW_ENV === 'sandbox'
        ? 'https://withdraw-sandbox.coinflow.cash'
        : 'https://withdraw.coinflow.cash';

      // Open Coinflow withdrawal widget
      window.open(
        `${widgetUrl}?sessionId=${data.sessionId}&merchantId=${COINFLOW_MERCHANT_ID}`,
        'coinflow-withdraw',
        'width=500,height=700'
      );

      onSuccess?.();
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }, [wallet, para, onSuccess, onError]);

  return {
    initiateWithdraw,
    isWalletConnected: !!wallet?.address && !!para,
    environment: COINFLOW_ENV,
  };
}; 