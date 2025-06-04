import { useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import QRCode from 'qrcode';
import { env } from '@/utils/env';
import { getStablecoinMint, STABLECOINS } from '@/utils/stablecoin-config';

export interface PaymentQRResult {
  qrCode: string;
  paymentUrl: string;
  isLoading: boolean;
  error: Error | null;
}

export function usePaymentQR() {
  const generatePaymentQR = useCallback(async (
    amount: number,
    merchantPubkey: PublicKey,
    isDevnet: boolean = true,
    memo?: string,
    token: string = 'USDC' // Back to single token
  ): Promise<PaymentQRResult> => {
    try {
      // Get the correct stablecoin mint for the network
      const tokenMint = getStablecoinMint(token, isDevnet);
      const tokenConfig = STABLECOINS[token.toUpperCase()];
      
      if (!tokenConfig) {
        throw new Error(`Unsupported token: ${token}`);
      }
      
      // Create the transaction request URL for fee-sponsored stablecoin transactions
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? env.productionUrl 
        : 'http://localhost:3000';
      
      const searchParams = new URLSearchParams({
        merchant: merchantPubkey.toString(),
        amount: amount.toString(),
        network: isDevnet ? 'devnet' : 'mainnet-beta',
        token: token.toUpperCase(), // Add token parameter
        ...(memo && { memo: memo.trim() })
      });

      // Transaction Request URL - this is what creates the fee-sponsored transaction
      const transactionRequestUrl = `${baseUrl}/api/payment/transaction?${searchParams}`;

      // Create Solana Pay Transaction Request URL
      const url = encodeURL({
        link: new URL(transactionRequestUrl),
        label: `GotSOL ${tokenConfig.name} Payment`,
        message: `Pay $${amount} ${token}${memo ? ` for ${memo.trim()}` : ''} (GotSOL covers all fees)`,
      });

      const urlString = url.toString();

      console.log('Transaction Request QR generated:', {
        type: 'Transaction Request (not direct transfer)',
        amount: `$${amount} ${token}`,
        merchant: merchantPubkey.toString(),
        network: isDevnet ? 'devnet' : 'mainnet',
        token: token.toUpperCase(),
        tokenMint: tokenMint.toString(),
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