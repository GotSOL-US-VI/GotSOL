'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Program, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { usePara } from '../para/para-provider';
import { useConnection } from '@/lib/connection-context';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import toast from 'react-hot-toast';
import * as anchor from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction 
} from '@solana/spl-token';

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

  const publicKey = useMemo(() => address ? new PublicKey(address) : null, [address]);

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !program) return;

    try {
      // Get the merchant's USDC ATA
      const merchantUsdcAta = await getAssociatedTokenAddress(
        isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        merchantPubkey,
        true
      );

      // Get the owner's USDC ATA
      const ownerUsdcAta = await getAssociatedTokenAddress(
        isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        publicKey,
        true
      );

      // Get the house's USDC ATA
      const houseUsdcAta = await getAssociatedTokenAddress(
        isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        HOUSE,
        true
      );

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
      const merchantUsdcAta = await getAssociatedTokenAddress(
        isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        merchantPubkey,
        true
      );

      // Get the owner's USDC ATA
      const ownerUsdcAta = await getAssociatedTokenAddress(
        isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        publicKey,
        true
      );

      // Get the house's USDC ATA
      const houseUsdcAta = await getAssociatedTokenAddress(
        isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
        HOUSE,
        true
      );

      // Withdraw funds using withdrawUsdc instruction
      const tx = await program.methods
        .withdrawUsdc(new BN(Math.floor(parseFloat(withdrawAmount) * 1e6))) // Convert to USDC base units
        .accountsPartial({
          owner: publicKey,
          merchant: merchantPubkey,
          usdcMint: isDevnet ? USDC_DEVNET_MINT : USDC_MAINNET_MINT,
          merchantUsdcAta: merchantUsdcAta,
          ownerUsdcAta: ownerUsdcAta,
          house: HOUSE,
          houseUsdcAta: houseUsdcAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

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
      <div className="flex items-center gap-2">
        <h2 className="text-xl">Withdraw Funds</h2>
        <div className="opacity-60 cursor-help" title="Help text">ⓘ</div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm opacity-60">Merchant&apos;s USDC Balance</span>
          <span>
            {displayMerchantBalance !== null ? `${displayMerchantBalance.toFixed(6)} USDC` : '0.000000 USDC'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm opacity-60">Owner&apos;s USDC Balance</span>
          <span>
            {displayOwnerBalance !== null ? `${displayOwnerBalance.toFixed(6)} USDC` : '0.000000 USDC'}
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-60">
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

      {!publicKey && (
        <p className="text-sm text-center opacity-60">
          Please connect your wallet to withdraw funds
        </p>
      )}

      {displayMerchantBalance !== null && displayMerchantBalance <= 0 && publicKey && (
        <p className="text-sm text-center opacity-60">
        </p>
      )}
    </div>
  );
}