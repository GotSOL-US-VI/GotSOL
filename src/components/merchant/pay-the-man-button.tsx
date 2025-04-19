'use client';

import * as anchor from "@coral-xyz/anchor";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { usePara } from "../para/para-provider";
import { useConnection } from "@solana/wallet-adapter-react";

interface PayTheManButtonProps {
    program: Program<Idl>;
    merchantPubkey: PublicKey;
    merchantName: string;
    onSuccess?: () => void;
}

export function PayTheManButton({ program, merchantPubkey, merchantName, onSuccess }: PayTheManButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string>('');
    const [escrowBalance, setEscrowBalance] = useState<number>(0);
    const [lifetimePaid, setLifetimePaid] = useState<number>(0);
    const [lastPayment, setLastPayment] = useState<number>(0);
    const [lastPaymentDate, setLastPaymentDate] = useState<string>('Never');
    const { address } = usePara();
    const { connection } = useConnection();
    const publicKey = useMemo(() => address ? new PublicKey(address) : null, [address]);

    // Fetch escrow balance and compliance data
    const fetchData = useCallback(async () => {
        if (!publicKey || !connection) return;
        
        try {
            setIsRefreshing(true);
            setError('');
            
            // Get the USDC mint (using devnet for now)
            const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
            console.log('USDC Mint:', usdcMint.toString());
            
            // Find the compliance escrow PDA (which is already a USDC ATA)
            const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("compliance_escrow"),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );
            console.log('Compliance Escrow (USDC ATA):', complianceEscrowPda.toString());
            
            // Find the compliance state account PDA
            const [compliancePda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('compliance'),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );
            console.log('Compliance State Account:', compliancePda.toString());

            // Get the escrow account info (it's already a USDC ATA)
            try {
                console.log('Fetching escrow balance for:', complianceEscrowPda.toString());
                
                try {
                    const tokenAccount = await getAccount(connection, complianceEscrowPda);
                    console.log('Token account data:', tokenAccount);
                    
                    const balance = Number(tokenAccount.amount) / 1_000_000; // USDC has 6 decimals
                    console.log('Token account balance:', balance);
                    setEscrowBalance(balance);
                } catch (err) {
                    console.log('Error getting token account:', err);
                    setEscrowBalance(0);
                }
            } catch (err) {
                console.log('Compliance escrow not found or empty:', err);
                setEscrowBalance(0);
            }

            // Get the compliance state account info
            try {
                console.log('Fetching compliance state for:', compliancePda.toString());
                const complianceAccount = await (program.account as any).compliance.fetch(compliancePda);
                console.log('Compliance state data:', complianceAccount);
                
                if (complianceAccount) {
                    setLifetimePaid(Number(complianceAccount.lifetimePaid) / 1_000_000);
                    setLastPayment(complianceAccount.lastPayment);
                    
                    // Format the last payment date
                    if (complianceAccount.lastPayment > 0) {
                        const date = new Date(complianceAccount.lastPayment * 1000);
                        setLastPaymentDate(date.toLocaleDateString());
                    }
                    console.log('Lifetime paid set to:', Number(complianceAccount.lifetimePaid) / 1_000_000);
                    console.log('Last payment set to:', complianceAccount.lastPayment);
                }
            } catch (err) {
                console.log('Compliance state account not found yet:', err);
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
        fetchData();
    }, [fetchData]);

    // Set up polling for real-time updates
    useEffect(() => {
        const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [fetchData]);

    if (!address) return null;

    const handlePayTheMan = async () => {
        if (!publicKey || !connection) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Get the USDC mint (using devnet for now)
            const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
            console.log('USDC Mint:', usdcMint.toString());
            
            // Find the compliance escrow PDA (which is already a USDC ATA)
            const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("compliance_escrow"),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );
            console.log('Compliance Escrow (USDC ATA):', complianceEscrowPda.toString());

            // Find the compliance state account PDA
            const [compliancePda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('compliance'),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );
            console.log('Compliance State Account:', compliancePda.toString());

            // Get THE_MAN's pubkey
            const theManPubkey = new PublicKey('7WxjvbhBgAcWfTnL8yQy6iP1vF4n5fKPc7tL7fMYvSsc');
            console.log('THE_MAN pubkey:', theManPubkey.toString());
            
            // Get THE_MAN's USDC ATA
            const theManUsdcAta = getAssociatedTokenAddressSync(
                usdcMint,
                theManPubkey,
                false // allowOwnerOffCurve = false since this is a normal account
            );
            console.log('THE_MAN USDC ATA:', theManUsdcAta.toString());

            // Call the paytheman instruction
            console.log('Calling paytheman instruction with accounts:');
            console.log('- owner:', publicKey.toString());
            console.log('- merchant:', merchantPubkey.toString());
            console.log('- complianceEscrow:', complianceEscrowPda.toString());
            console.log('- compliance:', compliancePda.toString());
            console.log('- usdcMint:', usdcMint.toString());
            console.log('- theMan:', theManPubkey.toString());
            console.log('- theManUsdcAta:', theManUsdcAta.toString());
            
            const tx = await program.methods
                .paytheman()
                .accountsPartial({
                    owner: publicKey,
                    merchant: merchantPubkey,
                    complianceEscrow: complianceEscrowPda,
                    compliance: compliancePda,
                    usdcMint,
                    theMan: theManPubkey,
                    theManUsdcAta,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log('Paid GOV:', tx);
            
            // Refresh the data
            await fetchData();
            
            // Call the onSuccess callback if provided
            onSuccess?.();
        } catch (err) {
            console.error('Failed to make revenue payment:', err);
            setError(err instanceof Error ? err.message : 'Failed to make revenue payment');
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
                    <div className="stat-desc">Available for tax payments</div>
                </div>
                <div className="stat">
                    <div className="stat-title">Lifetime Paid</div>
                    <div className="stat-value">{lifetimePaid.toFixed(6)} USDC</div>
                    <div className="stat-desc">Total taxes paid to date</div>
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
                onClick={handlePayTheMan}
                className={`btn btn-primary w-full ${isLoading ? 'loading' : ''}`}
                disabled={!publicKey || escrowBalance <= 0 || isLoading}
            >
                {isLoading ? 'Processing...' : 'Make revenue payment (in development, coming soon)'}
            </button>

            {!publicKey && (
                <p className="text-sm text-center opacity-60 mt-2">
                    Please connect your wallet to make revenue payments.
                </p>
            )}

            {escrowBalance <= 0 && publicKey && (
                <p className="text-sm text-center opacity-60 mt-2">
                    No funds available in revenue escrow, withdraw USDC from your Merchant&apos;s USDC balance to increase your escrow&apos;s balance.
                </p>
            )}
        </div>
    );
} 