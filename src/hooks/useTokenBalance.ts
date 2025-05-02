import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { useWallet } from "@getpara/react-sdk";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Helper function to get associated token address
async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0];
}

export function useTokenBalance(mintAddress: string) {
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
      const mintPublicKey = new PublicKey(mintAddress);

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

    // Set up polling
    const interval = setInterval(fetchBalance, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance
  };
} 