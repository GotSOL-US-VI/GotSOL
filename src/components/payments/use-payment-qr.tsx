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
      width: 512, // Increased resolution for better clarity
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

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const size = canvas.width;
      const centerSize = size * 0.18; // Slightly smaller for better QR readability

      // Create a larger white circle background with padding
      const paddingSize = centerSize * 1.1;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, paddingSize / 2, 0, 2 * Math.PI);
      ctx.fill();

      // Add a clean border
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 3;
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
            return '/icons/branding/fdusd-logo-03.svg'; // Using the higher quality version
          case 'USDG':
            return '/icons/branding/USDG Token/SVG/GDN_USDG_Token.svg';
          default:
            return '/icons/branding/solanaLogoMark.svg';
        }
      };

      // Load and draw token logo
      const img = new Image();
      img.onload = () => {
        // Calculate logo size (75% of the center circle for better proportion)
        const logoSize = centerSize * 0.75;
        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;

        // Save context state
        ctx.save();

        // Create clipping mask for the logo to ensure it stays within the circle
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, logoSize / 2, 0, 2 * Math.PI);
        ctx.clip();

        // Draw the token logo with high quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);

        // Restore context state
        ctx.restore();

        // Convert canvas to data URL with high quality
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      img.onerror = () => {
        // Fallback to clean text if image fails to load
        ctx.fillStyle = '#1F2937';
        ctx.font = `bold ${centerSize * 0.25}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token, size / 2, size / 2);
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      // Set CORS and load the image
      img.crossOrigin = 'anonymous';
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