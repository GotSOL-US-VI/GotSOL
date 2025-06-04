import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useCallback } from 'react';
import { encodeURL, createQR } from '@solana/pay';
import { BigNumber } from 'bignumber.js';
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

export function usePaymentQR() {
  const { connection } = useConnection();

  const generatePaymentQR = useCallback(async (
    amount: number,
    merchantPubkey: PublicKey,
    isDevnet: boolean = true,
    memo?: string,
  ): Promise<PaymentQRResult> => {
    try {
      // Get the correct USDC mint for the network
      const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
      
      // Create the transaction request URL for fee-sponsored USDC transactions
      // This points to your API that creates the actual transaction
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? env.productionUrl 
        : 'http://localhost:3000';
      
      const searchParams = new URLSearchParams({
        merchant: merchantPubkey.toString(),
        amount: amount.toString(),
        network: isDevnet ? 'devnet' : 'mainnet-beta',
        ...(memo && { memo: memo.trim() })
      });

      // Transaction Request URL - this is what creates the fee-sponsored transaction
      const transactionRequestUrl = `${baseUrl}/api/payment/transaction?${searchParams}`;

      // Create Solana Pay Transaction Request URL
      // This creates a QR code that when scanned, asks the wallet to request a transaction from your API
      // Your API will then create a USDC transfer transaction with fee sponsorship
      const url = encodeURL({
        link: new URL(transactionRequestUrl),
        label: "GotSOL USDC Payment",
        message: `Pay $${amount} USDC${memo ? ` for ${memo.trim()}` : ''} (GotSOL covers all fees)`,
      });

      const urlString = url.toString();

      console.log('Transaction Request QR generated:', {
        type: 'Transaction Request (not direct transfer)',
        amount: `$${amount} USDC`,
        merchant: merchantPubkey.toString(),
        network: isDevnet ? 'devnet' : 'mainnet',
        usdcMint: usdcMint.toString(),
        apiEndpoint: transactionRequestUrl,
        feeSponsorship: 'GotSOL fee payer covers all transaction fees',
        memo: memo || 'none'
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(urlString, {
        errorCorrectionLevel: "H",
        margin: 4,
        width: 400,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return {
        qrCode,
        paymentUrl: urlString,
        isLoading: false,
        error: null
      };
    } catch (error) {
      console.error("Error creating Transaction Request QR:", error);
      return {
        qrCode: '',
        paymentUrl: '',
        isLoading: false,
        error: error as Error
      };
    }
  }, []);

  return { generatePaymentQR };
} 