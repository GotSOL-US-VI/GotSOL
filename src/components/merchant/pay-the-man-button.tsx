'use client';

import * as anchor from "@coral-xyz/anchor";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { usePara } from "../para/para-provider";
import toast from 'react-hot-toast';

const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const GOV = new PublicKey('7WxjvbhBgAcWfTnL8yQy6iP1vF4n5fKPc7tL7fMYvSsc');

interface MakeRevenuePaymentButtonProps {
    program: Program<Idl>;
    merchantPubkey: PublicKey;
    merchantName: string;
    onSuccess?: () => void;
}

export function MakeRevenuePaymentButton({ program, merchantPubkey, merchantName, onSuccess }: MakeRevenuePaymentButtonProps) {
    console.log('MakeRevenuePaymentButton rendered with merchant:', merchantPubkey.toString());

    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string>('');
    const [escrowBalance, setEscrowBalance] = useState<number>(0);
    const [lifetimePaid, setLifetimePaid] = useState<number>(0);
    const [lastPayment, setLastPayment] = useState<number>(0);
    const [lastPaymentDate, setLastPaymentDate] = useState<string>('Never');
    const { address } = usePara();
    const publicKey = useMemo(() => {
        console.log('Wallet address changed:', address);
        return address ? new PublicKey(address) : null;
    }, [address]);

    // Use program's connection instead of wallet adapter's
    const connection = useMemo(() => program.provider.connection, [program]);

    // Fetch escrow balance and compliance data
    const fetchData = useCallback(async () => {
        console.log('fetchData called, publicKey:', publicKey?.toString(), 'connection:', !!connection);
        if (!publicKey) {
            console.log('Missing publicKey, skipping fetch');
            return;
        }
        
        try {
            setIsRefreshing(true);
            setError('');
            
            // Find the compliance escrow PDA
            const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("compliance_escrow"),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );
            console.log('Derived Compliance Escrow PDA:', complianceEscrowPda.toString());
            console.log('Expected Compliance Escrow:', '6tRAFHJc5T6SoWmwY5B1EjK4nkqQVgjXD4BM1v1qGjbN');
            
            // Find the compliance state account PDA
            const [compliancePda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('compliance'),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );

            // Get the escrow account balance
            try {
                console.log('Fetching token account info for compliance escrow...');
                const tokenAccount = await getAccount(connection, complianceEscrowPda);
                console.log('Token Account Data:', {
                    mint: tokenAccount.mint.toString(),
                    owner: tokenAccount.owner.toString(),
                    amount: tokenAccount.amount.toString()
                });
                
                const balance = Number(tokenAccount.amount) / 1_000_000; // USDC has 6 decimals
                console.log('Calculated Balance:', balance, 'USDC');
                setEscrowBalance(balance);
            } catch (err) {
                console.error('Error fetching compliance escrow:', err);
                setEscrowBalance(0);
            }

            // Get the compliance state account info
            try {
                const complianceAccount = await (program.account as any).compliance.fetch(compliancePda);
                if (complianceAccount) {
                    setLifetimePaid(Number(complianceAccount.lifetimePaid) / 1_000_000);
                    setLastPayment(complianceAccount.lastPayment.toNumber());
                    
                    if (complianceAccount.lastPayment.toNumber() > 0) {
                        const date = new Date(complianceAccount.lastPayment.toNumber() * 1000);
                        setLastPaymentDate(date.toLocaleDateString());
                    }
                }
            } catch (err) {
                console.log('Compliance state account not found yet');
                setLifetimePaid(0);
                setLastPayment(0);
                setLastPaymentDate('Never');
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to fetch compliance data');
        } finally {
            setIsRefreshing(false);
        }
    }, [merchantPubkey, publicKey, program, connection]);

    // Initial data fetch
    useEffect(() => {
        console.log('Initial fetchData useEffect triggered');
        fetchData();
    }, [fetchData]);

    // Set up polling for real-time updates
    useEffect(() => {
        console.log('Setting up polling interval');
        const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
        return () => {
            console.log('Cleaning up polling interval');
            clearInterval(interval);
        };
    }, [fetchData]);

    const handleMakeRevenuePayment = async () => {
        if (!publicKey || !connection) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Find the compliance escrow PDA
            const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("compliance_escrow"),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );

            // Find the compliance state account PDA
            const [compliancePda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('compliance'),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );
            
            // Get GOV's USDC ATA
            const theManUsdcAta = getAssociatedTokenAddressSync(
                USDC_DEVNET_MINT,
                GOV,
                false
            );

            // Call the make_revenue_payment instruction
            const tx = await program.methods
                .make_revenue_payment()
                .accountsPartial({
                    owner: publicKey,
                    merchant: merchantPubkey,
                    complianceEscrow: complianceEscrowPda,
                    compliance: compliancePda,
                    usdcMint: USDC_DEVNET_MINT,
                    theMan: GOV,
                    theManUsdcAta: theManUsdcAta,
                    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            toast.success(
                <div>
                    <p>Successfully paid revenue payment</p>
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
                { duration: 8000 }
            );
            
            // Refresh the data
            await fetchData();
            
            // Call the onSuccess callback if provided
            onSuccess?.();
        } catch (err) {
            console.error('Failed to make revenue payment:', err);
            setError(err instanceof Error ? err.message : 'Failed to make revenue payment');
            toast.error('Failed to make revenue payment');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card bg-base-300 shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Revenue Payments</h2>
                <button 
                    className="btn btn-sm btn-ghost" 
                    onClick={fetchData}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? (
                        <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                </button>
            </div>
            
            <div className="stats shadow mb-6">
                <div className="stat">
                    <div className="stat-title">Escrow Balance</div>
                    <div className="stat-value">{escrowBalance.toFixed(6)} USDC</div>
                    <div className="stat-desc">Available for revenue payments</div>
                </div>
                <div className="stat">
                    <div className="stat-title">Lifetime Paid</div>
                    <div className="stat-value">{lifetimePaid.toFixed(6)} USDC</div>
                    <div className="stat-desc">Total revenue paid to date</div>
                </div>
                <div className="stat">
                    <div className="stat-title">Last Payment</div>
                    <div className="stat-value">{lastPaymentDate}</div>
                    <div className="stat-desc">Date of most recent payment</div>
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            )}

            <button
                onClick={handleMakeRevenuePayment}
                className={`btn btn-primary w-full ${isLoading ? 'loading' : ''}`}
                disabled={!publicKey || escrowBalance <= 0 || isLoading}
            >
                {isLoading ? 'Processing...' : 'Make revenue payment'}
            </button>

            {!publicKey && (
                <p className="text-sm text-center opacity-60 mt-2">
                    Please connect your wallet to make revenue payments.
                </p>
            )}

            {escrowBalance <= 0 && publicKey && (
                <p className="text-sm text-center opacity-60 mt-2">
                    No funds available in revenue escrow. Withdraw USDC from your Merchant&apos;s USDC balance to increase your escrow&apos;s balance.
                </p>
            )}
        </div>
    );
} 