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
 * Optimized for quick updates when new payments are received
 */
export function useUsdcBalance({
  address,
  isDevnet = true,
  enabled = true,
  staleTime = 2000, // Consider data stale after 2s (lowered from 5s)
  refetchInterval = false, // Disable automatic polling by default
  refetchOnMount = true,
  refetchOnWindowFocus = true
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