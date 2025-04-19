'use client';

import * as anchor from "@coral-xyz/anchor";
import { useState, useEffect, useMemo } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
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
    const [error, setError] = useState<string>('');
    const [escrowBalance, setEscrowBalance] = useState<number>(0);
    const [lifetimePaid, setLifetimePaid] = useState<number>(0);
    const [lastPayment, setLastPayment] = useState<number>(0);
    const [lastPaymentDate, setLastPaymentDate] = useState<string>('Never');
    const { address } = usePara();
    const { connection } = useConnection();
    const publicKey = useMemo(() => address ? new PublicKey(address) : null, [address]);

    // Fetch escrow balance and compliance data
    useEffect(() => {
        if (!publicKey) return;
        
        const fetchData = async () => {
            try {
                // Get the USDC mint (using devnet for now)
                const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
                
                // Find the compliance escrow PDA - now using program PDA instead of ATA
                const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("compliance_escrow"),
                        merchantPubkey.toBuffer()
                    ],
                    program.programId
                );

                // Find the compliance PDA
                const [compliancePda] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('compliance'),
                        Buffer.from(merchantName),
                        publicKey.toBuffer(),
                    ],
                    program.programId
                );

                // Get the escrow account info
                const escrowAccount = await connection.getTokenAccountBalance(complianceEscrowPda);
                if (escrowAccount) {
                    setEscrowBalance(Number(escrowAccount.value.amount) / 1_000_000); // USDC has 6 decimals
                }

                // Get the compliance account info
                try {
                    // Use type assertion to bypass TypeScript checking for the compliance account
                    const complianceAccount = await (program.account as any).compliance.fetch(compliancePda);
                    if (complianceAccount) {
                        setLifetimePaid(Number(complianceAccount.lifetimePaid) / 1_000_000);
                        setLastPayment(complianceAccount.lastPayment);
                        
                        // Format the last payment date
                        if (complianceAccount.lastPayment > 0) {
                            const date = new Date(complianceAccount.lastPayment * 1000);
                            setLastPaymentDate(date.toLocaleDateString());
                        }
                    }
                } catch (err) {
                    console.log('Compliance account not found yet');
                }
            } catch (err) {
                console.error('Error fetching data:', err);
            }
        };

        fetchData();
    }, [merchantPubkey, merchantName, publicKey, program, connection]);

    if (!address) return null;

    const handlePayTheMan = async () => {
        if (!publicKey) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Get the USDC mint (using devnet for now)
            const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
            
            // Find the compliance escrow PDA - now using program PDA instead of ATA
            const [complianceEscrowPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("compliance_escrow"),
                    merchantPubkey.toBuffer()
                ],
                program.programId
            );

            // Find the compliance PDA
            const [compliancePda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('compliance'),
                    Buffer.from(merchantName),
                    publicKey.toBuffer(),
                ],
                program.programId
            );

            // Get THE_MAN's pubkey
            const theManPubkey = new PublicKey('7WxjvbhBgAcWfTnL8yQy6iP1vF4n5fKPc7tL7fMYvSsc');
            
            // Find THE_MAN's USDC ATA
            const [theManUsdcAta] = PublicKey.findProgramAddressSync(
                [
                    theManPubkey.toBuffer(),
                    anchor.utils.token.ASSOCIATED_PROGRAM_ID.toBuffer(),
                    usdcMint.toBuffer(),
                ],
                anchor.utils.token.ASSOCIATED_PROGRAM_ID
            );

            // Call the paytheman instruction
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

            console.log('Paid THE MAN:', tx);
            
            // Refresh the data
            const escrowAccount = await connection.getTokenAccountBalance(complianceEscrowPda);
            if (escrowAccount) {
                setEscrowBalance(Number(escrowAccount.value.amount) / 1_000_000);
            }

            try {
                // Use type assertion to bypass TypeScript checking for the compliance account
                const complianceAccount = await (program.account as any).compliance.fetch(compliancePda);
                if (complianceAccount) {
                    setLifetimePaid(Number(complianceAccount.lifetimePaid) / 1_000_000);
                    setLastPayment(complianceAccount.lastPayment);
                    
                    // Format the last payment date
                    if (complianceAccount.lastPayment > 0) {
                        const date = new Date(complianceAccount.lastPayment * 1000);
                        setLastPaymentDate(date.toLocaleDateString());
                    }
                }
            } catch (err) {
                console.log('Compliance account not found yet');
            }

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
            <h2 className="text-2xl font-bold mb-6">Revenue Payments</h2>
            
            <div className="stats shadow mb-6">
                <div className="stat">
                    <div className="stat-title">Escrow Balance</div>
                    <div className="stat-value">{escrowBalance.toFixed(2)} USDC</div>
                </div>
                <div className="stat">
                    <div className="stat-title">Lifetime Paid</div>
                    <div className="stat-value">{lifetimePaid.toFixed(2)} USDC</div>
                </div>
                <div className="stat">
                    <div className="stat-title">Last Payment</div>
                    <div className="stat-value">{lastPaymentDate}</div>
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