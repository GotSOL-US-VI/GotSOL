import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { useCallback } from 'react';
import { useAnchorProvider } from '../solana/solana-provider';
import { Program, Idl } from '@coral-xyz/anchor';
import idl from '../../utils/kumbaya.json';
import QRCode from 'qrcode';

// Constants for fee splits and USDC mint
const MERCHANT_SHARE = 985; // 98.5%
const HOUSE_SHARE = 15;    // 1.5%

// USDC mint addresses
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export interface PaymentQRResult {
  qrCode: string;
  serializedTransaction: {
    transaction: Uint8Array;
    merchant: string;
    amount: number;
    splits: {
      merchant: number;
      house: number;
    };
  } | null;
  isLoading: boolean;
  error: Error | null;
}

export function usePaymentQR(program: Program<Idl>) {
  const { connection } = useConnection();
  const provider = useAnchorProvider();

  const generatePaymentQR = useCallback(async (
    amount: number,
    merchantPubkey: PublicKey,
    isDevnet: boolean = true,
  ): Promise<PaymentQRResult> => {
    try {
      // Verify the merchant exists by attempting to fetch their account
      await (program.account as any).merchant.fetch(merchantPubkey);

      // Get the global account to find the house address
      const [global] = PublicKey.findProgramAddressSync(
        [Buffer.from("global")],
        program.programId
      );
      const globalAccount = await (program.account as any).global.fetch(global);

      // Use the appropriate USDC mint based on the network
      const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;

      // Get the merchant's USDC ATA
      const merchantUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        merchantPubkey,
        true
      );

      // Get the house's USDC ATA
      const houseUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        globalAccount.house,
        true
      );

      // Calculate the split amounts (converting to USDC decimals - 6)
      const amountBaseUnits = Math.floor(amount * 1_000_000);
      const merchantAmount = Math.floor((amountBaseUnits * MERCHANT_SHARE) / 1000);
      const houseAmount = Math.floor((amountBaseUnits * HOUSE_SHARE) / 1000);

      // Create a new transaction
      const transaction = new Transaction();

      // Create a placeholder for the payer's token account and public key
      const PAYER_PLACEHOLDER = new PublicKey("11111111111111111111111111111111");

      // Add merchant transfer instruction
      transaction.add(
        createTransferCheckedInstruction(
          PAYER_PLACEHOLDER,
          usdcMint,
          merchantUsdcAta,
          PAYER_PLACEHOLDER,
          merchantAmount,
          6
        )
      );

      // Add house fee transfer instruction
      transaction.add(
        createTransferCheckedInstruction(
          PAYER_PLACEHOLDER,
          usdcMint,
          houseUsdcAta,
          PAYER_PLACEHOLDER,
          houseAmount,
          6
        )
      );

      // Serialize the transaction to JSON
      const serializedTransaction = {
        transaction: transaction.serialize({ requireAllSignatures: false }),
        merchant: merchantPubkey.toBase58(),
        amount: amount,
        splits: {
          merchant: merchantAmount / 1_000_000,
          house: houseAmount / 1_000_000,
        },
      };

      // Generate QR code
      const qrCode = await QRCode.toDataURL(JSON.stringify(serializedTransaction), {
        errorCorrectionLevel: "H",
        margin: 4,
        width: 400,
      });

      return {
        qrCode,
        serializedTransaction,
        isLoading: false,
        error: null
      };
    } catch (error) {
      console.error("Error creating payment QR:", error);
      return {
        qrCode: '',
        serializedTransaction: null,
        isLoading: false,
        error: error as Error
      };
    }
  }, [program]);

  return { generatePaymentQR };
} 