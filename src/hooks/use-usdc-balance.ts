import { PublicKey } from '@solana/web3.js';
import { useTokenBalanceQuery } from './use-token-balance';
import { USDC_MINT, USDC_DEVNET_MINT } from '@/utils/token-utils';

interface UseUsdcBalanceProps {
  address: PublicKey;
  isDevnet?: boolean;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}

/**
 * Specialized hook for USDC balances that utilizes the more general token balance hook
 * Optimized to reduce excessive refreshing while maintaining accuracy
 */
export function useUsdcBalance({
  address,
  isDevnet = true,
  enabled = true,
  staleTime = 30000, // Increased to 30s to reduce frequent fetches
  refetchInterval = false, // Disable automatic polling - rely on explicit invalidation
  refetchOnMount = false, // Only fetch when data is stale
  refetchOnWindowFocus = false // Disable window focus refetch to reduce noise
}: UseUsdcBalanceProps) {
  const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
  
  return useTokenBalanceQuery({
    address,
    mintAddress: usdcMint,
    enabled,
    staleTime,
    refetchInterval,
    refetchOnMount,
    refetchOnWindowFocus
  });
} 