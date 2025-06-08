import { useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import QRCode from 'qrcode';
import { env } from '@/utils/env';
import { getStablecoinMint, STABLECOINS, isNativeToken } from '@/utils/stablecoin-config';
import { solPriceService } from '@/utils/sol-price-service';

export interface PaymentQRResult {
  qrCode: string;
  paymentUrl: string;
  isLoading: boolean;
  error: Error | null;
  solAmountInfo?: {
    solAmount: number;
    solPrice: number;
    expiresAt: number;
  };
}

// Function to create stylized QR code with token logo
async function createStylizedQR(data: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // First generate the base QR code to canvas
    QRCode.toCanvas(data, {
      errorCorrectionLevel: "H",
      margin: 4,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }, (error, canvas) => {
      if (error) {
        reject(error);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const size = canvas.width;
      const centerSize = size * 0.2; // 20% of QR code size

      // Create a white circle background for the token logo
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, centerSize / 2, 0, 2 * Math.PI);
      ctx.fill();

      // Add a subtle border
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Get the correct logo path for the token
      const getTokenLogoPath = (tokenSymbol: string): string => {
        switch (tokenSymbol.toUpperCase()) {
          case 'SOL':
            return '/icons/branding/solanaLogoMark.svg';
          case 'USDC':
            return '/icons/branding/Token Logo/USDC Token.svg';
          case 'USDT':
            return '/icons/branding/tether logo.svg';
          case 'FDUSD':
            return '/icons/branding/fdusd-logo-04.svg';
          case 'USDG':
            return '/icons/branding/USDG Token/SVG/GDN_USDG_Token.svg';
          default:
            return '/icons/branding/solanaLogoMark.svg';
        }
      };

      // Load and draw token logo
      const img = new Image();
      img.onload = () => {
        // Calculate logo size (80% of the circle size)
        const logoSize = centerSize * 0.8;
        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;

        // Draw the token logo
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);

        // Convert canvas to data URL
        resolve(canvas.toDataURL());
      };

      img.onerror = () => {
        // Fallback to text if image fails to load
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${centerSize * 0.3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token, size / 2, size / 2);
        resolve(canvas.toDataURL());
      };

      // Set the image source to trigger loading
      img.src = getTokenLogoPath(token);
    });
  });
}

export function usePaymentQR() {
  const generatePaymentQR = useCallback(async (
    amount: number,
    merchantPubkey: PublicKey,
    isDevnet: boolean = true,
    memo?: string,
    token: string = 'USDC'
  ): Promise<PaymentQRResult> => {
    try {
      const tokenUpper = token.toUpperCase();
      const tokenConfig = STABLECOINS[tokenUpper];
      const isNative = isNativeToken(tokenUpper);
      
      if (!tokenConfig) {
        throw new Error(`Unsupported token: ${token}`);
      }

      // For SOL, get the price conversion info
      let solAmountInfo: { solAmount: number; solPrice: number; expiresAt: number } | undefined;
      if (isNative) {
        solAmountInfo = await solPriceService.convertUSDToSOL(amount);
        console.log('SOL QR generation - price conversion:', {
          usdAmount: amount,
          solAmount: solAmountInfo.solAmount,
          solPrice: solAmountInfo.solPrice,
          expiresAt: new Date(solAmountInfo.expiresAt).toISOString()
        });
      }

      // Get the correct stablecoin mint for the network (not needed for SOL but keep for compatibility)
      const tokenMint = isNative ? null : getStablecoinMint(token, isDevnet);
      
      // Create the transaction request URL for fee-sponsored stablecoin transactions
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? env.productionUrl 
        : 'http://localhost:3000';
      
      const searchParams = new URLSearchParams({
        merchant: merchantPubkey.toString(),
        amount: amount.toString(),
        network: isDevnet ? 'devnet' : 'mainnet-beta',
        token: token.toUpperCase(),
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
        usdAmount: `$${amount}`,
        tokenAmount: isNative && solAmountInfo ? 
          `${solAmountInfo.solAmount.toFixed(6)} SOL` : 
          `$${amount} ${token}`,
        ...(solAmountInfo && { solPrice: `$${solAmountInfo.solPrice.toFixed(2)}` }),
        merchant: merchantPubkey.toString(),
        network: isDevnet ? 'devnet' : 'mainnet',
        token: tokenUpper,
        tokenMint: tokenMint?.toString() || 'N/A (native SOL)',
        apiEndpoint: transactionRequestUrl,
        feeSponsorship: 'GotSOL fee payer covers all transaction fees',
        memo: memo || 'none'
      });

      // Generate stylized QR code with token logo
      const qrCode = await createStylizedQR(urlString, token.toUpperCase());

      return {
        qrCode,
        paymentUrl: urlString,
        isLoading: false,
        error: null,
        solAmountInfo
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