'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface WithdrawFundsProps {
  merchantPubkey: PublicKey;
  ownerPubkey: PublicKey;
  isDevnet?: boolean;
  onSuccess?: () => void;
  onBalanceUpdate?: (balance: number) => void;
  onOwnerBalanceUpdate?: (balance: number) => void;
}

// USDC mint addresses
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

export function WithdrawFunds({ 
  merchantPubkey, 
  ownerPubkey,
  isDevnet = true,
  onSuccess, 
  onBalanceUpdate,
  onOwnerBalanceUpdate 
}: WithdrawFundsProps) {
  const { connection } = useConnection();
  const [localMerchantBalance, setLocalMerchantBalance] = useState<number>(0);
  const [localOwnerBalance, setLocalOwnerBalance] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [isBalancesVisible, setIsBalancesVisible] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (!merchantPubkey || !ownerPubkey || !connection) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get the USDC mint based on network
      const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;

      // Get ATAs for both merchant and owner
      const [merchantUsdcAta, ownerUsdcAta] = await Promise.all([
        findAssociatedTokenAddress(merchantPubkey, usdcMint),
        findAssociatedTokenAddress(ownerPubkey, usdcMint)
      ]);

      console.log('Fetching balances for:', {
        merchantPubkey: merchantPubkey.toString(),
        ownerPubkey: ownerPubkey.toString(),
        merchantUsdcAta: merchantUsdcAta.toString(),
        ownerUsdcAta: ownerUsdcAta.toString(),
        isDevnet
      });

      // Get account infos to check if ATAs exist
      const [merchantAtaInfo, ownerAtaInfo] = await Promise.all([
        connection.getAccountInfo(merchantUsdcAta),
        connection.getAccountInfo(ownerUsdcAta)
      ]);

      // Fetch balances for existing accounts
      const [merchantBalance, ownerBalance] = await Promise.all([
        merchantAtaInfo ? connection.getTokenAccountBalance(merchantUsdcAta).catch(() => null) : Promise.resolve(null),
        ownerAtaInfo ? connection.getTokenAccountBalance(ownerUsdcAta).catch(() => null) : Promise.resolve(null)
      ]);

      // Update local state
      const merchantUsdcBalance = merchantBalance ? Number(merchantBalance.value.uiAmount) : 0;
      const ownerUsdcBalance = ownerBalance ? Number(ownerBalance.value.uiAmount) : 0;

      setLocalMerchantBalance(merchantUsdcBalance);
      setLocalOwnerBalance(ownerUsdcBalance);

      // Update parent components if callbacks provided
      if (onBalanceUpdate) {
        onBalanceUpdate(merchantUsdcBalance);
      }
      if (onOwnerBalanceUpdate) {
        onOwnerBalanceUpdate(ownerUsdcBalance);
      }

    } catch (err) {
      console.error('Error fetching balances:', err);
      setError('Failed to fetch balances');
    } finally {
      setIsLoading(false);
    }
  }, [connection, merchantPubkey, ownerPubkey, isDevnet, onBalanceUpdate, onOwnerBalanceUpdate]);

  // Fetch balances on mount and when dependencies change
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleWithdraw = async () => {
    if (!merchantPubkey || !ownerPubkey || !connection) {
      setError('Please connect your wallet');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (localMerchantBalance === 0 || parseFloat(withdrawAmount) > localMerchantBalance) {
      setError('Insufficient balance');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement withdrawal using Para's API
      // This will need to be implemented based on your specific requirements
      // and Para's available methods for withdrawing funds
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      toast.success('Withdrawal successful!');
      setWithdrawAmount('');
      await fetchBalances();
      
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

  const handleMaxClick = () => {
    if (localMerchantBalance > 0) {
      setWithdrawAmount(localMerchantBalance.toFixed(6));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setWithdrawAmount(value);
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-base-content/10 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl">Withdraw Funds</h2>
          <div className="opacity-60 cursor-help" title="1% platform fee on withdrawal amount. 99% to the Merchant's Owner.">ⓘ</div>
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
          <span className="text-sm">Merchant's USDC Balance</span>
          <span>
            {isBalancesVisible 
              ? (localMerchantBalance > 0 ? `${localMerchantBalance.toFixed(6)} USDC` : '0.000000 USDC')
              : '••••••• USDC'
            }
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">Owner's USDC Balance</span>
          <span>
            {isBalancesVisible
              ? (localOwnerBalance > 0 ? `${localOwnerBalance.toFixed(6)} USDC` : '0.000000 USDC')
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
          disabled={isLoading || localMerchantBalance <= 0}
        >
          MAX
        </button>
        <button
          onClick={handleWithdraw}
          className="btn btn-primary"
          disabled={
            !merchantPubkey || 
            !ownerPubkey || 
            !withdrawAmount || 
            parseFloat(withdrawAmount) <= 0 || 
            localMerchantBalance <= 0 || 
            parseFloat(withdrawAmount) > localMerchantBalance || 
            isLoading
          }
        >
          {isLoading ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}