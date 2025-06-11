import { PublicKey } from '@solana/web3.js';
import { useTokenBalanceQuery } from './use-token-balance';
import { useSolBalance } from './use-sol-balance';
import { getStablecoinMint, STABLECOINS, isNativeToken } from '@/utils/stablecoin-config';
import type { SupportedToken } from '@/components/payments/token-selector';

interface UseMultiTokenBalanceProps {
  address: PublicKey;
  token: SupportedToken;
  isDevnet?: boolean;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}

/**
 * Hook for fetching balance for any supported token
 * Handles both native SOL and SPL token balances with proper routing
 */
export function useMultiTokenBalance({
  address,
  token,
  isDevnet = true,
  enabled = true,
  staleTime = 2000,
  refetchInterval = false,
  refetchOnMount = true,
  refetchOnWindowFocus = true
}: UseMultiTokenBalanceProps) {
  
  // Route to appropriate balance hook based on token type
  const solBalanceQuery = useSolBalance({
    address,
    enabled: enabled && token === 'SOL',
    staleTime,
    refetchInterval,
    refetchOnMount,
    refetchOnWindowFocus
  });

  const splTokenBalanceQuery = useTokenBalanceQuery({
    address,
    mintAddress: token !== 'SOL' ? getStablecoinMint(token, isDevnet) : new PublicKey('11111111111111111111111111111111'), // dummy address for SOL
    enabled: enabled && token !== 'SOL',
    staleTime,
    refetchInterval,
    refetchOnMount,
    refetchOnWindowFocus
  });

  // Return the appropriate data based on token type
  if (token === 'SOL') {
    return {
      data: solBalanceQuery.data?.solBalance || 0,
      usdBalance: solBalanceQuery.data?.usdBalance || 0,
      solPrice: solBalanceQuery.data?.solPrice || 0,
      priceExpiresAt: solBalanceQuery.data?.priceExpiresAt || 0,
      isLoading: solBalanceQuery.isLoading,
      error: solBalanceQuery.error,
      refetch: solBalanceQuery.refetch,
      isNative: true
    };
  }

  return {
    data: splTokenBalanceQuery.data || 0,
    usdBalance: splTokenBalanceQuery.data || 0, // For stablecoins, balance ≈ USD value
    solPrice: 0,
    priceExpiresAt: 0,
    isLoading: splTokenBalanceQuery.isLoading,
    error: splTokenBalanceQuery.error,
    refetch: splTokenBalanceQuery.refetch,
    isNative: false
  };
}

/**
 * Helper function to get token display name and decimals
 */
export function getTokenInfo(token: SupportedToken) {
  const config = STABLECOINS[token.toUpperCase()];
  return {
    name: config?.name || token,
    symbol: config?.symbol || token,
    decimals: config?.decimals || 6,
    isNative: config?.isNative || false
  };
} 