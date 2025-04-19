'use client';

import { useState, useEffect, useMemo } from 'react';
import { Program, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { usePara } from '../para/para-provider';
import { useConnection } from '@/lib/connection-context';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import toast from 'react-hot-toast';
import * as anchor from '@coral-xyz/anchor';

const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const MERCHANT_SHARE = 935; // 93.5%
const GOV_SHARE = 50; // 5%
const HOUSE_SHARE = 15; // 1.5%
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

interface WithdrawFundsProps {
  program: Program<Idl>;
  merchantPubkey: PublicKey;
  isDevnet?: boolean;
}

export function WithdrawFunds({ program, merchantPubkey, isDevnet = true }: WithdrawFundsProps) {
  const { connection } = useConnection();
  const { address, signer } = usePara();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string>('');

  const publicKey = useMemo(() => address ? new PublicKey(address) : null, [address]);

  const [merchantBalance, setMerchantBalance] = useState<number | null>(null);
  const [ownerBalance, setOwnerBalance] = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [showBalances, setShowBalances] = useState(true);

  const toggleBalances = () => {
    setShowBalances(!showBalances);
  };

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        if (!merchantPubkey || !publicKey) return;

        const merchantAta = await getAssociatedTokenAddress(
          USDC_DEVNET_MINT,
          merchantPubkey,
          true
        );

        const ownerAta = await getAssociatedTokenAddress(
          USDC_DEVNET_MINT,
          publicKey,
          true
        );

        // Fetch both balances in parallel
        const [merchantBalanceResponse, ownerBalanceResponse] = await Promise.all([
          connection.getTokenAccountBalance(merchantAta).catch(() => null),
          connection.getTokenAccountBalance(ownerAta).catch(() => null)
        ]);

        setMerchantBalance(merchantBalanceResponse ? Number(merchantBalanceResponse.value.uiAmount) : null);
        setOwnerBalance(ownerBalanceResponse ? Number(ownerBalanceResponse.value.uiAmount) : null);
      } catch (err) {
        console.error('Error fetching balances:', err);
        setMerchantBalance(null);
        setOwnerBalance(null);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [connection, merchantPubkey, publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }
    // ... rest of the effect
  }, [publicKey, connection, program, merchantPubkey]);

  const handleWithdraw = async () => {
    if (!publicKey || !program || !withdrawAmount) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert to USDC base units (6 decimals)
      const amount = new BN(Math.floor(parseFloat(withdrawAmount) * 1e6));

      // Calculate owner's share for display purposes
      const ownerShare = (parseFloat(withdrawAmount) * MERCHANT_SHARE) / 1000;

      console.log('Withdrawing amount:', amount.toString());

      // Get the merchant account to verify ownership
      const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey);
      
      if (!merchantAccount || merchantAccount.owner.toString() !== publicKey.toString()) {
        throw new Error('You are not the owner of this merchant account');
      }

      // Find the compliance escrow PDA
      const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("compliance_escrow"),
          merchantPubkey.toBuffer()
        ],
        program.programId
      );

      // Find the owner's USDC ATA
      const ownerUsdcAta = await getAssociatedTokenAddress(
        USDC_DEVNET_MINT,
        publicKey,
        true
      );

      // Find the merchant's USDC ATA
      const merchantUsdcAta = await getAssociatedTokenAddress(
        USDC_DEVNET_MINT,
        merchantPubkey,
        true
      );

      const tx = await program.methods
        .withdrawUsdc(amount)
        .accountsPartial({
          owner: publicKey,
          merchant: merchantPubkey,
          usdcMint: USDC_DEVNET_MINT,
          merchantUsdcAta: merchantUsdcAta,
          complianceEscrow: complianceEscrowPda,
          ownerUsdcAta: ownerUsdcAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        })
        .rpc();

      console.log('Transaction successful:', tx);

      toast.success(
        <div>
          <p>Successfully withdrew {withdrawAmount} USDC</p>
          <p className="text-sm">You will receive: {ownerShare.toFixed(6)} USDC (93.5% in the future, currently you receive 95% though)</p>
          <p className="text-sm">Revenue payments split: {((parseFloat(withdrawAmount) * GOV_SHARE) / 1000).toFixed(6)} USDC (5%)</p>
          <p className="text-sm">Future Platform fee: {((parseFloat(withdrawAmount) * HOUSE_SHARE) / 1000).toFixed(6)} USDC (1.5%, not currently imposed)</p>
          <p className="text-xs mt-1">
            <a
              href={`https://solscan.io/tx/${tx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          </p>
        </div>,
        {
          duration: 8000,
        }
      );

      // Reset form and refresh balances
      setWithdrawAmount('');

    } catch (err) {
      console.error('Error withdrawing funds:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw funds');
      toast.error('Failed to withdraw funds');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-base-200 rounded-lg p-4 ">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Withdraw Funds
          <button
            className="btn btn-ghost btn-xs tooltip tooltip-right"
            data-tip="1.5% platform fee applies to withdrawals (for future mainnet)"
          >
            ⓘ
          </button>
        </h2>
        <button
          onClick={toggleBalances}
          className="btn btn-ghost btn-sm"
        >
          {showBalances ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          )}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center bg-base-300 p-3 rounded-lg">
          <span className="text-sm">Merchant&apos;s USDC Balance</span>
          <span className="font-semibold">
            {showBalances
              ? (merchantBalance !== null ? `${merchantBalance.toFixed(6)} USDC` : '...')
              : '••••••••'}
          </span>
        </div>

        <div className="flex justify-between items-center bg-base-300 p-3 rounded-lg">
          <span className="text-sm">Owner&apos;s USDC Balance</span>
          <span className="font-semibold">
            {showBalances
              ? (ownerBalance !== null ? `${ownerBalance.toFixed(6)} USDC` : '...')
              : '••••••••'}
          </span>
        </div>

        <div className="form-control mt-6">
          <label className="label">
            <span className="label-text">Amount to Withdraw</span>
          </label>
          <div className="flex flex-col gap-2 w-full">
            <input
              type="number"
              placeholder="0.00"
              className="input input-bordered w-full"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              min="0"
              step="0.000001"
              disabled={isLoading}
            />
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                className="btn btn-sm w-full"
                onClick={() => merchantBalance && setWithdrawAmount(merchantBalance.toString())}
                disabled={isLoading || merchantBalance === null}
              >
                MAX
              </button>
              <button
                className={`btn btn-sm btn-primary w-full ${isLoading ? 'loading' : ''}`}
                onClick={handleWithdraw}
                disabled={
                  isLoading ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) <= 0 ||
                  (merchantBalance !== null && parseFloat(withdrawAmount) > merchantBalance)
                }
              >
                {isLoading ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>

        {/* {withdrawAmount && (
          <div className="text-sm space-y-1 text-gray-500">
            <p>You will receive: {((parseFloat(withdrawAmount) * MERCHANT_SHARE) / 1000).toFixed(6)} USDC</p>
            <p>Platform fee: {(parseFloat(withdrawAmount) * (1 - MERCHANT_SHARE / 1000)).toFixed(6)} USDC</p>
          </div>
        )} */}

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}