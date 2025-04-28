import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useCallback } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { encodeURL} from '@solana/pay';
import BigNumber from 'bignumber.js';
import QRCode from 'qrcode';
import { env } from '@/utils/env';

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

// USDC mint addresses
const USDC_MINT = new PublicKey(env.usdcMint);
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export interface PaymentQRResult {
  qrCode: string;
  paymentUrl: string;
  isLoading: boolean;
  error: Error | null;
}

export function usePaymentQR(program: Program<Idl>) {
  const { connection } = useConnection();

  const generatePaymentQR = useCallback(async (
    amount: number,
    merchantPubkey: PublicKey,
    isDevnet: boolean = true,
    memo?: string,
  ): Promise<PaymentQRResult> => {
    try {
      // Verify the merchant exists by attempting to fetch their account
      await (program.account as any).merchant.fetch(merchantPubkey);

      // Get the merchant's USDC ATA
      const merchantUsdcAta = await findAssociatedTokenAddress(
        merchantPubkey,
        isDevnet ? USDC_DEVNET_MINT : USDC_MINT
      );

      // Calculate the total amount in USDC base units (6 decimals for USDC)
      const amountBaseUnits = new BigNumber(amount).times(1e6).integerValue();

      console.log('Amount details:', {
        input: amount,
        baseUnits: amountBaseUnits.toString(),
        inUSDC: amountBaseUnits.dividedBy(1e6).toString()
      });

      // Create Solana Pay transfer URL
      const url = encodeURL({
        recipient: merchantUsdcAta,
        amount: new BigNumber(amount), // Pass the original amount, Solana Pay will handle decimals
        splToken: isDevnet ? USDC_DEVNET_MINT : USDC_MINT,
        reference: [merchantPubkey],
        label: "GotSOL Payment",
        message: `Payment to ${merchantPubkey.toString().slice(0, 4)}...${merchantPubkey.toString().slice(-4)}`,
        ...(memo ? { memo } : { memo: `$${amount} USDC Payment for merchant ${merchantPubkey.toString()}` })
      });

      const urlString = url.toString();
      console.log('Solana Pay URL:', urlString);
      console.log('Payment details:', {
        recipient: merchantUsdcAta.toString(),
        amount: amountBaseUnits,
        token: isDevnet ? USDC_DEVNET_MINT.toString() : USDC_MINT.toString()
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(urlString, {
        errorCorrectionLevel: "H",
        margin: 4,
        width: 400,
      });

      return {
        qrCode,
        paymentUrl: urlString,
        isLoading: false,
        error: null
      };
    } catch (error) {
      console.error("Error creating payment QR:", error);
      return {
        qrCode: '',
        paymentUrl: '',
        isLoading: false,
        error: error as Error
      };
    }
  }, [program]);

  return { generatePaymentQR };
} 