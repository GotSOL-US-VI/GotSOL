'use client';

import { useState } from 'react';
import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet, useClient } from "@getpara/react-sdk";
import * as anchor from "@coral-xyz/anchor";
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { getKumbayaProgram } from '@/utils/kumbaya-exports';

interface WithdrawFundsProps {
  merchantPubkey: PublicKey;
  ownerPubkey: PublicKey;
  isDevnet?: boolean;
  onSuccess?: () => void;
}

// USDC mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const HOUSE = new PublicKey('Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih');

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

  // Use the new hook for both merchant and owner balances
  const { data: merchantBalance = 0, isLoading: isMerchantBalanceLoading } = useUsdcBalance({
    address: merchantPubkey,
    isDevnet
  });

  const { data: ownerBalance = 0, isLoading: isOwnerBalanceLoading } = useUsdcBalance({
    address: ownerPubkey,
    isDevnet
  });

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
      const program = getKumbayaProgram(provider);

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

      // Invalidate the balance queries to trigger a refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet] }),
        queryClient.invalidateQueries({ queryKey: ['usdc-balance', ownerPubkey.toString(), isDevnet] })
      ]);

      toast.success(
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
        </div>,
        { duration: 8000 }
      );

      setWithdrawAmount('');
      
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