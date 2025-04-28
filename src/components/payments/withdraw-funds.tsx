'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Program, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { usePara } from '../para/para-provider';
import { useConnection } from '@/lib/connection-context';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { executeTransactionWithFeePayer } from '@/utils/execute-transaction';

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

const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MAINNET_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const MERCHANT_SHARE = 990; // 99%
// const GOV_SHARE = 50; // 5%
const HOUSE_SHARE = 10; // 10%
const HOUSE = new PublicKey('Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih');

interface WithdrawFundsProps {
  program: Program<Idl>;
  merchantPubkey: PublicKey;
  onSuccess?: () => void;
  isDevnet?: boolean;
  onBalanceUpdate?: (balance: number) => void;
  onOwnerBalanceUpdate?: (balance: number) => void;
  merchantBalance?: number;
  ownerBalance?: number;
}

export function WithdrawFunds({ 
  program, 
  merchantPubkey, 
  onSuccess, 
  isDevnet = true,
  onBalanceUpdate,
  onOwnerBalanceUpdate,
  merchantBalance: propMerchantBalance,
  ownerBalance: propOwnerBalance
}: WithdrawFundsProps) {
  const { connection } = useConnection();
  const { address, signer } = usePara();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [showBalances, setShowBalances] = useState(true);
  const [localMerchantBalance, setLocalMerchantBalance] = useState<number | null>(null);
  const [localOwnerBalance, setLocalOwnerBalance] = useState<number | null>(null);
  const [isBalancesVisible, setIsBalancesVisible] = useState(true);

  const publicKey = useMemo(() => address ? new PublicKey(address) : null, [address]);

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !program) return;

    try {
      // Get the merchant's USDC ATA
      const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT);

      // Get the owner's USDC ATA
      const ownerUsdcAta = await findAssociatedTokenAddress(publicKey, isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT);

      // Get the house's USDC ATA
      const houseUsdcAta = await findAssociatedTokenAddress(HOUSE, isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT);

      // Get merchant balance
      try {
        const merchantBalanceResponse = await connection.getTokenAccountBalance(merchantUsdcAta);
        const merchantBalance = merchantBalanceResponse ? Number(merchantBalanceResponse.value.uiAmount) : 0;
        setLocalMerchantBalance(merchantBalance);
        if (onBalanceUpdate) {
          onBalanceUpdate(merchantBalance);
        }
      } catch (err) {
        console.error('Error fetching merchant balance:', err);
        setLocalMerchantBalance(null);
      }

      // Get owner balance
      try {
        const ownerBalanceResponse = await connection.getTokenAccountBalance(ownerUsdcAta);
        const ownerBalance = ownerBalanceResponse ? Number(ownerBalanceResponse.value.uiAmount) : 0;
        setLocalOwnerBalance(ownerBalance);
        if (onOwnerBalanceUpdate) {
          onOwnerBalanceUpdate(ownerBalance);
        }
      } catch (err) {
        console.error('Error fetching owner balance:', err);
        setLocalOwnerBalance(null);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError('Failed to fetch balances');
    }
  }, [publicKey, program, connection, merchantPubkey, isDevnet, onBalanceUpdate, onOwnerBalanceUpdate]);

  useEffect(() => {
    fetchBalances();
    // Set up an interval to refresh balances
    const intervalId = setInterval(fetchBalances, 10000); // Refresh every 10 seconds
    return () => clearInterval(intervalId);
  }, [fetchBalances]);

  // Use prop values if available, otherwise use local state
  const displayMerchantBalance = propMerchantBalance ?? localMerchantBalance;
  const displayOwnerBalance = propOwnerBalance ?? localOwnerBalance;

  const handleWithdraw = async () => {
    if (!publicKey || !program || !signer) {
      setError('Please connect your wallet');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (displayMerchantBalance === null || parseFloat(withdrawAmount) > displayMerchantBalance) {
      setError('Insufficient balance');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the merchant's USDC ATA
      const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT);

      // Get the owner's USDC ATA
      const ownerUsdcAta = await findAssociatedTokenAddress(publicKey, isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT);

      // Get the house's USDC ATA
      const houseUsdcAta = await findAssociatedTokenAddress(HOUSE, isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT);

      // Withdraw funds using withdrawUsdc instruction with the fee payer
      const methodBuilder = program.methods.withdrawUsdc(new BN(Math.floor(parseFloat(withdrawAmount) * 1e6))); // Convert to USDC base units
      
      // Log the method builder for debugging
      console.log('Method builder created for withdrawUsdc');
      
      // Create a fresh PublicKey instance to ensure it's valid
      let ownerPublicKey: PublicKey;
      try {
        ownerPublicKey = new PublicKey(publicKey.toString());
      } catch (error) {
        console.error('Error creating owner public key:', error);
        setError('Invalid owner public key');
        setIsLoading(false);
        return;
      }
      
      // Log the public key for debugging
      console.log('Owner public key:', {
        original: publicKey.toString(),
        new: ownerPublicKey.toString(),
        isValid: PublicKey.isOnCurve(ownerPublicKey),
        bytes: Array.from(ownerPublicKey.toBytes()).join(',')
      });
      
      // Verify all public keys are valid
      const verifyPublicKey = (key: PublicKey, name: string) => {
        try {
          const isValid = PublicKey.isOnCurve(key);
          console.log(`${name} public key:`, {
            value: key.toString(),
            isValid,
            bytes: Array.from(key.toBytes()).join(',')
          });
          return isValid;
        } catch (error) {
          console.error(`Error verifying ${name} public key:`, error);
          return false;
        }
      };
      
      // Verify all public keys
      verifyPublicKey(ownerPublicKey, 'Owner');
      verifyPublicKey(merchantPubkey, 'Merchant');
      verifyPublicKey(isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT, 'USDC Mint');
      verifyPublicKey(merchantUsdcAta, 'Merchant USDC ATA');
      verifyPublicKey(ownerUsdcAta, 'Owner USDC ATA');
      verifyPublicKey(HOUSE, 'House');
      verifyPublicKey(houseUsdcAta, 'House USDC ATA');
      verifyPublicKey(ASSOCIATED_TOKEN_PROGRAM_ID, 'Associated Token Program');
      verifyPublicKey(TOKEN_PROGRAM_ID, 'Token Program');
      
      const accounts = {
        owner: ownerPublicKey,
        merchant: merchantPubkey,
        usdcMint: isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        merchantUsdcAta: merchantUsdcAta,
        ownerUsdcAta: ownerUsdcAta,
        house: HOUSE,
        houseUsdcAta: houseUsdcAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
      
      // Log the accounts for debugging
      console.log('Accounts for transaction:', {
        owner: accounts.owner.toString(),
        merchant: accounts.merchant.toString(),
        usdcMint: accounts.usdcMint.toString(),
        merchantUsdcAta: accounts.merchantUsdcAta.toString(),
        ownerUsdcAta: accounts.ownerUsdcAta.toString(),
        house: accounts.house.toString(),
        houseUsdcAta: accounts.houseUsdcAta.toString(),
      });
      
      // Execute the transaction with the fee payer
      const tx = await executeTransactionWithFeePayer(program, methodBuilder, accounts, signer);

      console.log('Withdrawal successful:', tx);
      toast.success('Withdrawal successful!');
      
      // Reset withdraw amount
      setWithdrawAmount('');
      
      // Refresh balances
      await fetchBalances();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error withdrawing funds:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw funds');
      toast.error('Failed to withdraw funds');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBalances = () => {
    setShowBalances(!showBalances);
  };

  const handleMaxClick = () => {
    if (displayMerchantBalance !== null) {
      setWithdrawAmount(displayMerchantBalance.toString());
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string or valid decimal numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setWithdrawAmount(value);
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-base-content/10 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl">Withdraw Funds</h2>
          <div className="opacity-60 cursor-help" title="1% platform fee on withdrawal amount. 99% to the Merchant&apos;s Owner.">ⓘ</div>
        </div>
        <button
          onClick={() => setIsBalancesVisible(!isBalancesVisible)}
          className="btn btn-ghost btn-sm btn-circle"
        >
          {isBalancesVisible ? (
            <EyeIcon className="h-5 w-5" />
          ) : (
            <EyeSlashIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm">Merchant&apos;s USDC Balance</span>
          <span>
            {isBalancesVisible 
              ? (displayMerchantBalance !== null ? `${displayMerchantBalance.toFixed(6)} USDC` : '0.000000 USDC')
              : '••••••• USDC'
            }
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">Owner&apos;s USDC Balance</span>
          <span>
            {isBalancesVisible
              ? (displayOwnerBalance !== null ? `${displayOwnerBalance.toFixed(6)} USDC` : '0.000000 USDC')
              : '••••••• USDC'
            }
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-80">
            Amount to Withdraw
          </label>
          <input
            type="text"
            placeholder="0.00"
            className="input input-bordered w-full"
            value={withdrawAmount}
            onChange={handleAmountChange}
            disabled={isLoading}
          />
        </div>
      </div>

      {error && (
        <div className="text-error text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleMaxClick}
          className="btn btn-outline"
          disabled={isLoading || displayMerchantBalance === null || displayMerchantBalance <= 0}
        >
          MAX
        </button>
        <button
          onClick={handleWithdraw}
          className="btn btn-primary"
          disabled={
            !publicKey || 
            !withdrawAmount || 
            parseFloat(withdrawAmount) <= 0 || 
            displayMerchantBalance === null || 
            parseFloat(withdrawAmount) > displayMerchantBalance || 
            isLoading
          }
        >
          {isLoading ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}