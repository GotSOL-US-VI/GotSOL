import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection } from '@/lib/connection-context';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

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

interface UseUsdcBalanceProps {
  address: PublicKey;
  isDevnet?: boolean;
  enabled?: boolean;
}

export function useUsdcBalance({ address, isDevnet = true, enabled = true }: UseUsdcBalanceProps) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['usdc-balance', address.toString(), isDevnet],
    queryFn: async () => {
      const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
      const ata = await findAssociatedTokenAddress(address, usdcMint);
      
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
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval: 20000, // Refetch every 20 seconds
  });
} 