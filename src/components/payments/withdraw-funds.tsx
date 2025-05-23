'use client';

import { useState } from 'react';
import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { toastUtils } from '@/utils/toast-utils';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet, useClient } from "@getpara/react-sdk";
import * as anchor from "@coral-xyz/anchor";
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { USDC_MINT, USDC_DEVNET_MINT, HOUSE, findAssociatedTokenAddress } from '@/utils/token-utils';
import { parseAnchorError, ErrorToastContent } from '@/utils/error-parser';

interface WithdrawFundsProps {
  merchantPubkey: PublicKey;
  ownerPubkey: PublicKey;
  isDevnet?: boolean;
  onSuccess?: () => void;
}

export function WithdrawFunds({ 
  merchantPubkey, 
  ownerPubkey,
  isDevnet = true,
  onSuccess
}: WithdrawFundsProps) {
  const { connection } = useConnection();
  const { data: wallet } = useWallet();
  const para = useClient();
  const queryClient = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBalancesVisible, setIsBalancesVisible] = useState(true);

  // Use the TanStack Query hooks with refetch capabilities
  const { 
    data: merchantBalance = 0, 
    isLoading: isMerchantBalanceLoading, 
    refetch: refetchMerchantBalance 
  } = useUsdcBalance({
    address: merchantPubkey,
    isDevnet,
    staleTime: 5000 // Consider data stale after 5s
  });

  const { 
    data: ownerBalance = 0, 
    isLoading: isOwnerBalanceLoading,
    refetch: refetchOwnerBalance
  } = useUsdcBalance({
    address: ownerPubkey,
    isDevnet,
    staleTime: 5000
  });

  // Function to trigger an immediate balance refresh
  const refreshBalances = async () => {
    try {
      // Invalidate queries to force fresh fetches
      await queryClient.invalidateQueries({ 
        queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet]
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['usdc-balance', ownerPubkey.toString(), isDevnet]
      });
      
      // Also invalidate the general token balance queries
      await queryClient.invalidateQueries({
        queryKey: ['token-balance']
      });
      
      // Execute direct refetches
      await Promise.all([
        refetchMerchantBalance(),
        refetchOwnerBalance()
      ]);
    } catch (err) {
      console.error('Error refreshing balances:', err);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet?.address || !connection || !para) {
      setError('Please connect your wallet');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (merchantBalance === 0 || parseFloat(withdrawAmount) > merchantBalance) {
      setError('Insufficient balance');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create Para Solana signer
      const solanaSigner = new ParaSolanaWeb3Signer(para, connection);

      // Create the provider with Para signer
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: new PublicKey(wallet.address),
          signTransaction: solanaSigner.signTransaction.bind(solanaSigner),
          signAllTransactions: async (txs) => {
            return Promise.all(txs.map(tx => solanaSigner.signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Get the program using the helper function
      const program = getGotsolProgram(provider);

      // Convert amount to USDC decimals (6 decimals)
      const withdrawAmountU64 = Math.floor(parseFloat(withdrawAmount) * 1_000_000);

      // Get the USDC mint based on network
      const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;

      // Get merchant's USDC ATA
      const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

      // Get owner's USDC ATA
      const ownerUsdcAta = await findAssociatedTokenAddress(ownerPubkey, usdcMint);

      // Get house's USDC ATA
      const houseUsdcAta = await findAssociatedTokenAddress(HOUSE, usdcMint);

      // Send the withdraw transaction
      const txid = await program.methods
        .withdrawUsdc(new anchor.BN(withdrawAmountU64))
        .accountsPartial({
          owner: ownerPubkey,
          merchant: merchantPubkey,
          merchantUsdcAta: merchantUsdcAta,
          ownerUsdcAta: ownerUsdcAta,
          house: HOUSE,
          houseUsdcAta: houseUsdcAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Trigger immediate balance refresh
      await refreshBalances();
      
      // Set a short timeout and refresh again to ensure balances are updated
      // as blockchain transactions might take a moment to finalize
      setTimeout(async () => {
        await refreshBalances();
      }, 2000);

      toastUtils.success(
        <div>
          <p>Withdrawal successful!</p>
          <p className="text-xs mt-1">
            <a
              href={formatSolscanDevnetLink(txid)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          </p>
        </div>
      );

      setWithdrawAmount('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error withdrawing funds:', err);
      
      // Parse the error to get a more user-friendly message
      const parsedError = parseAnchorError(err);
      setError(parsedError.message);

      // Display appropriate error message based on the error code
      switch (parsedError.code) {
        case 'INSUFFICIENT_FUNDS':
          toastUtils.error(
            <ErrorToastContent 
              title="Insufficient funds" 
              message="The merchant account doesn't have enough USDC for this withdrawal" 
            />
          );
          break;
        case 'NOT_MERCHANT_OWNER':
          toastUtils.error(
            <ErrorToastContent 
              title="Unauthorized" 
              message="Only the merchant owner can withdraw funds" 
            />
          );
          break;
        case 'INACTIVE_MERCHANT':
          toastUtils.error(
            <ErrorToastContent 
              title="Inactive merchant" 
              message="This merchant account is currently inactive" 
            />
          );
          break;
        default:
          // Generic error message with details if available
          toastUtils.error(
            <ErrorToastContent 
              title="Failed to withdraw funds" 
              message={parsedError.message} 
            />
          );
      }
      
      // Still refresh balances in case of partial success
      refreshBalances();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (merchantBalance > 0) {
      setWithdrawAmount(merchantBalance.toFixed(6));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setWithdrawAmount(value);
    }
  };

  const isLoadingBalances = isMerchantBalanceLoading || isOwnerBalanceLoading;

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
          {isLoadingBalances ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <span>
              {isBalancesVisible 
                ? (merchantBalance > 0 ? `${merchantBalance.toFixed(6)} USDC` : '0.000000 USDC')
                : '••••••• USDC'
              }
            </span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">Owner&apos;s USDC Balance</span>
          {isLoadingBalances ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <span>
              {isBalancesVisible
                ? (ownerBalance > 0 ? `${ownerBalance.toFixed(6)} USDC` : '0.000000 USDC')
                : '••••••• USDC'
              }
            </span>
          )}
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
          disabled={isLoading || merchantBalance <= 0}
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
            merchantBalance <= 0 || 
            parseFloat(withdrawAmount) > merchantBalance || 
            isLoading
          }
        >
          {isLoading ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}