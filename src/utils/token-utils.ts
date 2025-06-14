import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Common USDC mint addresses used throughout the application
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// House and Government addresses
export const HOUSE = new PublicKey('Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih');
export const GOV = new PublicKey('7WxjvbhBgAcWfTnL8yQy6iP1vF4n5fKPc7tL7fMYvSsc');

/**
 * Helper function to find the associated token address for a wallet and token mint
 */
export async function findAssociatedTokenAddress(
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

/**
 * Utility function to format USDC amount with appropriate decimal places
 */
export const formatUSDCAmount = (amount: number): string => {
  // For amounts between 0.10 and 0.90, always show 2 decimal places
  if (amount >= 0.10 && amount < 1 && amount.toFixed(6).endsWith('000000')) {
    return amount.toFixed(2);
  }
  // For all other amounts, show up to 6 decimals but trim trailing zeros
  const withDecimals = amount.toFixed(6);
  return withDecimals.replace(/\.?0+$/, '');
}; 