import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { useWallet } from "@getpara/react-sdk";
import { useQuery } from '@tanstack/react-query';
import { findAssociatedTokenAddress } from '@/utils/token-utils';

/**
 * Hook for fetching token balance using React Query
 */
interface UseTokenBalanceQueryProps {
  address: PublicKey;
  mintAddress: PublicKey;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}

export function useTokenBalanceQuery({ 
  address, 
  mintAddress, 
  enabled = true,
  staleTime = 60 * 1000, // Increased to 1 minute default
  refetchInterval = false, // Disabled automatic polling by default
  refetchOnMount = false, // Don't refetch on mount - use cache
  refetchOnWindowFocus = false // Don't refetch on window focus
}: UseTokenBalanceQueryProps) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['token-balance', address.toString(), mintAddress.toString()],
    queryFn: async () => {
      // Get ATA
      const ata = await findAssociatedTokenAddress(address, mintAddress);
      
      // Check if ATA exists
      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) {
        return 0;
      }

      // Get balance
      const balance = await connection.getTokenAccountBalance(ata);
      return Number(balance.value.uiAmount || 0);
    },
    enabled: enabled && !!connection && !!address,
    staleTime, 
    refetchInterval,
    refetchOnMount,
    refetchOnWindowFocus,
    gcTime: 5 * 60 * 1000, // Keep in memory for 5 minutes
    retry: 1, // Reduce retries
  });
}

/**
 * Hook for fetching token balance using useEffect (for components that need more manual control)
 */
interface UseTokenBalanceEffectProps {
  mintAddress: string | PublicKey;
  pollingInterval?: number | null;
}

export function useTokenBalanceEffect({ mintAddress, pollingInterval = 2 * 60 * 1000 }: UseTokenBalanceEffectProps) {
  const { connection } = useConnection();
  const { data: wallet } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) {
      setBalance(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const publicKey = new PublicKey(wallet.address);
      const mintPublicKey = mintAddress instanceof PublicKey 
        ? mintAddress 
        : new PublicKey(mintAddress);

      // Get ATA
      const ata = await findAssociatedTokenAddress(
        publicKey,
        mintPublicKey
      );

      // Get account info
      const accountInfo = await connection.getAccountInfo(ata);
      
      if (!accountInfo) {
        setBalance(0);
        setIsLoading(false);
        return;
      }

      // Get token balance
      const tokenBalance = await connection.getTokenAccountBalance(ata);
      setBalance(Number(tokenBalance.value.uiAmount));

    } catch (err) {
      console.error('Error fetching token balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [connection, wallet?.address, mintAddress]);

  useEffect(() => {
    fetchBalance();

    // Set up polling if requested
    if (pollingInterval) {
      const interval = setInterval(fetchBalance, pollingInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchBalance, pollingInterval]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance
  };
} 