'use client';

import { useState } from 'react';
import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { toastUtils } from '@/utils/toast-utils';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet, useClient } from "@getpara/react-sdk";
import * as anchor from "@coral-xyz/anchor";
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { USDC_MINT, USDC_DEVNET_MINT, HOUSE, findAssociatedTokenAddress } from '@/utils/token-utils';
import { parseAnchorError, ErrorToastContent } from '@/utils/error-parser';
import { createClient } from '@/utils/supabaseClient';

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
  const { isBalancesVisible, toggleBalanceVisibility } = useBalanceVisibility();
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

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

      // Get the program to check merchant eligibility
      const program = getGotsolProgram(provider);
      let isFeeEligible = false;
      
      try {
        const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey);
        isFeeEligible = merchantAccount.feeEligible;
        console.log('Merchant fee eligible:', isFeeEligible);
      } catch (error) {
        console.warn('Failed to check merchant eligibility, using direct call:', error);
      }

      // Calculate amount in lamports for both cases
      const withdrawAmountU64 = Math.floor(parseFloat(withdrawAmount) * 1_000_000);
      let txid: string;

      // Smart routing: Use API for eligible merchants, direct call for others
      if (isFeeEligible) {
        console.log('Using API route for fee-eligible merchant');
        
        // Use the withdraw API route for fee-eligible merchants
        const network = isDevnet ? 'devnet' : 'mainnet';
        const apiUrl = `/api/withdraw/transaction?merchant=${merchantPubkey.toString()}&amount=${parseFloat(withdrawAmount)}&network=${network}`;
        
        // Get the transaction from API
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: wallet.address }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create withdraw transaction');
        }

        const { transaction: base64Transaction } = await response.json();
        
        // Deserialize and sign the transaction
        const transactionBuffer = Buffer.from(base64Transaction, 'base64');
        const transaction = anchor.web3.Transaction.from(transactionBuffer);
        
        // Sign with Para wallet
        const signedTransaction = await solanaSigner.signTransaction(transaction);
        
        // Send the signed transaction
        txid = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        
      } else {
        console.log('Using direct call for non-eligible merchant');
        
        // Direct program call for non-eligible merchants
        const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
        const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
        const ownerUsdcAta = await findAssociatedTokenAddress(ownerPubkey, usdcMint);
        const houseUsdcAta = await findAssociatedTokenAddress(HOUSE, usdcMint);

        const methodBuilder = program.methods
          .withdraw(new anchor.BN(withdrawAmountU64.toString()))
          .accountsPartial({
            owner: ownerPubkey,
            merchant: merchantPubkey,
            stablecoinMint: usdcMint,
            merchantStablecoinAta: merchantUsdcAta,
            ownerStablecoinAta: ownerUsdcAta,
            house: HOUSE,
            houseStablecoinAta: houseUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          });

        txid = await methodBuilder.rpc();
      }

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

      // Insert event data into Supabase
      const decimalAmount = parseFloat(withdrawAmount);

      await supabase.from('withdrawal_events').insert([
        {
          parawalletid: wallet.id,
          merchant_pda: merchantPubkey.toString(),
          owner_wallet: ownerPubkey.toString(),
          amount: withdrawAmountU64,
          decimal_amount: decimalAmount,
          txid,
        }
      ]);
    } catch (err) {
      console.error('Error withdrawing funds:', err);
      
      // Parse the error to get a more user-friendly message
      const parsedError = parseAnchorError(err);

      if (
        parsedError.message?.includes('BelowMinimumWithdrawal') ||
        parsedError.code === 'BELOW_MINIMUM_WITHDRAWAL'
      ) {
        setError('Amount is below the minimum withdrawal of 0.000100 for stablecoins.');
      } else if (
        parsedError.message?.toLowerCase().includes('insufficient') ||
        parsedError.code === 'INSUFFICIENT_FUNDS'
      ) {
        setError('Insufficient balance.');
      } else if (parsedError.code === 'NOT_MERCHANT_OWNER') {
        setError('Only the merchant owner can withdraw funds.');
      } else if (parsedError.code === 'INACTIVE_MERCHANT') {
        setError('This merchant account is currently inactive.');
      } else {
        setError('Failed to withdraw funds.');
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
    
    // Only allow numbers and a single decimal point
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    // Split on decimal point to check decimal places
    const [whole, decimal] = value.split('.');
    
    // If there's a decimal part, limit it to 6 places
    if (decimal && decimal.length > 6) {
      const truncatedDecimal = decimal.slice(0, 6);
      setWithdrawAmount(`${whole}.${truncatedDecimal}`);
      return;
    }

    // Ensure the value is not just a decimal point
    if (value === '.') {
      setWithdrawAmount('0.');
      return;
    }

    setWithdrawAmount(value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Only trigger withdrawal if form is valid and not loading
      const isFormValid = merchantPubkey && 
        ownerPubkey && 
        withdrawAmount && 
        parseFloat(withdrawAmount) > 0 && 
        merchantBalance > 0 && 
        parseFloat(withdrawAmount) <= merchantBalance && 
        !isLoading;
      
      if (isFormValid) {
        handleWithdraw();
      }
    }
  };

  const isLoadingBalances = isMerchantBalanceLoading || isOwnerBalanceLoading;

  return (
    <div className="space-y-6 rounded-lg border border-base-content/10 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl">Withdraw to Owner</h2>
          <div className="opacity-60 cursor-help" title="1% platform fee on withdrawal amount. 99% to the Merchant&apos;s Owner. You must withdraw here first before withdrawing to a bank or card.">ⓘ</div>
        </div>
        <button
          onClick={() => toggleBalanceVisibility()}
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
            onKeyDown={handleKeyDown}
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
          className={`btn btn-primary ${(!merchantPubkey || 
            !ownerPubkey || 
            !withdrawAmount || 
            parseFloat(withdrawAmount) <= 0 || 
            merchantBalance <= 0 || 
            parseFloat(withdrawAmount) > merchantBalance || 
            isLoading) ? 'bg-[#111111] hover:bg-[#111111] hover:transform-none' : ''}`}
        >
          {isLoading ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}