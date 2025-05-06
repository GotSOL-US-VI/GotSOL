'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js';
import { useEffect, useCallback } from 'react';
import { useConnection } from '@/lib/connection-context';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';
import { Program } from '@coral-xyz/anchor';
import { RefundButton } from './refund-button';
import type { Kumbaya } from '@/utils/kumbaya-exports';
import { retryWithBackoff } from '@/utils/para';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface PaymentHistoryProps {
    program: Program<Kumbaya>;
    merchantPubkey: PublicKey;
    isDevnet?: boolean;
    onBalanceUpdate?: (balance: number) => void;
}

interface Payment {
    signature: string;
    amount: number;
    memo: string | null;
    timestamp: number;
    sender: PublicKey;
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

// Utility function to format USDC amount
const formatUSDCAmount = (amount: number): string => {
    // For amounts between 0.10 and 0.90, always show 2 decimal places
    if (amount >= 0.10 && amount < 1 && amount.toFixed(6).endsWith('000000')) {
        return amount.toFixed(2);
    }
    // For all other amounts, show up to 6 decimals but trim trailing zeros
    const withDecimals = amount.toFixed(6);
    return withDecimals.replace(/\.?0+$/, '');
};

// Function to fetch payment data that can be used with React Query
async function fetchPaymentData(
    merchantPubkey: PublicKey, 
    connection: any, 
    isDevnet: boolean = true
): Promise<Payment[]> {
    if (!merchantPubkey || !connection) return [];
    
    try {
        // Get the merchant's USDC ATA
        const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
        const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
        
        // First check if the ATA exists
        const ataInfo = await connection.getAccountInfo(merchantUsdcAta);
        if (!ataInfo) {
            return [];
        }

        // Get all signatures for the merchant's USDC ATA
        const signatures = await connection.getSignaturesForAddress(merchantUsdcAta, {
            limit: 250
        });

        // Get the full transaction details for each signature
        const transactions = await Promise.all(
            signatures.map((sig: { signature: string }) => 
                connection.getParsedTransaction(sig.signature, 'confirmed')
            )
        );

        // Process and filter the transactions
        const processedPayments = await Promise.all(transactions
            .filter((tx): tx is ParsedTransactionWithMeta => 
                tx !== null && 
                tx.meta !== null
            )
            .map(async tx => {
                try {
                    // Find the token transfer instruction
                    const transferInstructions = tx.transaction.message.instructions.filter(
                        (instruction: ParsedInstruction | PartiallyDecodedInstruction) => {
                            if (!('parsed' in instruction)) return false;
                            if (instruction.program !== 'spl-token') return false;

                            const parsedData = typeof instruction.parsed === 'string' 
                                ? { type: instruction.parsed } 
                                : instruction.parsed;

                            if (!('type' in parsedData)) return false;

                            const { type } = parsedData;
                            const isTransferType = type === 'transfer' || type === 'transferChecked';
                            if (!isTransferType) return false;

                            let destination: string | undefined;
                            if ('info' in parsedData && parsedData.info) {
                                destination = parsedData.info.destination;
                            }

                            return destination === merchantUsdcAta.toString();
                        }
                    );

                    if (transferInstructions.length === 0) return null;

                    // Use the first matching instruction
                    const transferInstruction = transferInstructions[0] as ParsedInstruction;
                    
                    const parsedData = typeof transferInstruction.parsed === 'string'
                        ? { type: transferInstruction.parsed }
                        : transferInstruction.parsed;

                    if (!('info' in parsedData)) return null;

                    const info = parsedData.info;
                    const authority = info.authority || info.multisigAuthority || info.source;
                    const amount = info.tokenAmount?.amount || info.amount;

                    if (!authority || !amount) return null;

                    // Extract memo from transaction logs
                    let memo = null;
                    if (tx.meta?.logMessages) {
                        // Look for memo in transaction logs
                        const memoLog = tx.meta.logMessages.find(log => {
                            const lowerLog = log.toLowerCase();
                            return lowerLog.includes('program log: memo (len') || 
                                   lowerLog.includes('memo program: memo');
                        });
                        
                        if (memoLog) {
                            // Extract memo content
                            const matches = memoLog.match(/(?:Program log: Memo \(len \d+\): |Memo Program: Memo )(.+)/i);
                            if (matches && matches[1]) {
                                // Remove surrounding quotes if they exist
                                memo = matches[1].trim().replace(/^"(.*)"$/, '$1');
                            }
                        }
                    }

                    return {
                        signature: tx.transaction.signatures[0],
                        amount: Number(amount) / Math.pow(10, 6),
                        memo,
                        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                        sender: new PublicKey(authority)
                    };
                } catch (err) {
                    console.error('Error processing transaction:', err);
                    return null;
                }
            }));

        const validPayments = processedPayments.filter((payment): payment is Payment => payment !== null);
        return validPayments;
    } catch (error) {
        console.error('Error fetching payments:', error);
        throw new Error('Failed to fetch payment history');
    }
}

export function PaymentHistory({ program, merchantPubkey, isDevnet = true, onBalanceUpdate }: PaymentHistoryProps) {
    const { data: wallet } = useWallet();
    const { connection } = useConnection();
    const queryClient = useQueryClient();

    // Use React Query for payment data with caching
    const { 
        data: payments = [],
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['payments', merchantPubkey.toString(), isDevnet],
        queryFn: () => retryWithBackoff(() => fetchPaymentData(merchantPubkey, connection, isDevnet), 3, 2000),
        staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
        gcTime: 30 * 60 * 1000, // Cache retained for 30 minutes
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchOnMount: true, // Always refetch on mount to ensure fresh data
        enabled: !!merchantPubkey && !!connection,
    });

    // Use React Query for fetching balance
    const fetchBalance = useCallback(async () => {
        if (!merchantPubkey || !connection) return 0;
        
        try {
            const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
            const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
            const balance = await connection.getTokenAccountBalance(merchantUsdcAta).catch(() => null);
            return balance ? Number(balance.value.uiAmount || 0) : 0;
        } catch (error) {
            console.error('Error fetching balance:', error);
            return 0;
        }
    }, [connection, merchantPubkey, isDevnet]);

    // Fetch and update balance when needed
    const { data: balance } = useQuery({
        queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet],
        queryFn: fetchBalance,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        enabled: !!merchantPubkey && !!connection,
    });

    // Update balance via callback when it changes
    useEffect(() => {
        if (onBalanceUpdate && typeof balance === 'number') {
            onBalanceUpdate(balance);
        }
    }, [balance, onBalanceUpdate]);
    
    // Function to process a single transaction (for live updates)
    const processNewTransaction = useCallback(async (signature: string) => {
        try {
            const tx = await connection.getParsedTransaction(signature, 'confirmed');
            if (!tx || !tx.meta) return null;

            const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
            const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

            // Find the token transfer instruction
            const transferInstruction = tx.transaction.message.instructions.find(
                (instruction: ParsedInstruction | PartiallyDecodedInstruction) => {
                    if ('parsed' in instruction) {
                        if (instruction.program !== 'spl-token') return false;

                        const parsedData = typeof instruction.parsed === 'string' 
                            ? { type: instruction.parsed } 
                            : instruction.parsed;

                        if (!('type' in parsedData)) return false;

                        const { type } = parsedData;
                        const isTransferType = type === 'transfer' || type === 'transferChecked';
                        if (!isTransferType) return false;

                        let destination: string | undefined;
                        let amount: string | undefined;

                        if ('info' in parsedData && parsedData.info) {
                            destination = parsedData.info.destination;
                            amount = parsedData.info.tokenAmount?.amount || parsedData.info.amount;
                        }

                        return destination === merchantUsdcAta.toString();
                    }
                    return false;
                }
            );

            if (!transferInstruction || !('parsed' in transferInstruction)) return null;

            const parsedData = typeof transferInstruction.parsed === 'string'
                ? { type: transferInstruction.parsed }
                : transferInstruction.parsed;

            if (!('info' in parsedData)) return null;

            const info = parsedData.info;
            const authority = info.authority || info.multisigAuthority || info.source;
            const amount = info.tokenAmount?.amount || info.amount;

            if (!authority || !amount) return null;

            // Extract memo from transaction logs properly
            let memo = null;
            if (tx.meta?.logMessages) {
                // Look for memo in transaction logs
                const memoLog = tx.meta.logMessages.find(log => {
                    const lowerLog = log.toLowerCase();
                    return lowerLog.includes('program log: memo (len') || lowerLog.includes('memo program: memo');
                });
                
                if (memoLog) {
                    // Extract memo content
                    const matches = memoLog.match(/(?:Program log: Memo \(len \d+\): |Memo Program: Memo )(.+)/i);
                    if (matches && matches[1]) {
                        // Remove surrounding quotes if they exist
                        memo = matches[1].trim().replace(/^"(.*)"$/, '$1');
                    }
                }
            }

            const payment: Payment = {
                signature,
                amount: Number(amount) / Math.pow(10, 6),
                memo,
                timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                sender: new PublicKey(authority)
            };

            return payment;
        } catch (err) {
            console.error('Error processing new transaction:', err);
            return null;
        }
    }, [connection, merchantPubkey, isDevnet]);

    // Set up subscription to merchant's USDC ATA for real-time updates
    useEffect(() => {
        if (!merchantPubkey || !connection) return;

        const setupSubscription = async () => {
            try {
                const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
                const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

                // Subscribe to account changes
                const subscriptionId = connection.onAccountChange(
                    merchantUsdcAta,
                    async (_, context) => {
                        // Get the latest transaction signature
                        const signatures = await connection.getSignaturesForAddress(merchantUsdcAta, {
                            limit: 1
                        });

                        if (signatures.length === 0) return;

                        const latestSignature = signatures[0].signature;
                        const newPayment = await processNewTransaction(latestSignature);

                        if (newPayment) {
                            // Use queryClient to update the cached payment data
                            queryClient.setQueryData(
                                ['payments', merchantPubkey.toString(), isDevnet],
                                (oldData: Payment[] = []) => {
                                    // Check if payment already exists
                                    if (oldData.some(p => p.signature === newPayment.signature)) {
                                        return oldData;
                                    }
                                    // Add new payment to the top
                                    return [newPayment, ...oldData];
                                }
                            );

                            // Show toast notification for new payment
                            const toastMessage = (
                                <div>
                                    <p>{formatUSDCAmount(newPayment.amount)} USDC payment received!</p>
                                    {newPayment.memo && (
                                        <p className="text-sm mt-1 opacity-90">{newPayment.memo}</p>
                                    )}
                                </div>
                            );
                            toast.success(toastMessage, {
                                duration: 8000,
                                position: 'bottom-right'
                            });

                            // Invalidate the merchant's USDC balance query
                            queryClient.invalidateQueries({
                                queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet]
                            });
                        }
                    },
                    'confirmed'
                );

                // Cleanup subscription on unmount
                return () => {
                    connection.removeAccountChangeListener(subscriptionId);
                };
            } catch (err) {
                console.error('Error setting up USDC ATA subscription:', err);
                toast.error('Failed to set up real-time updates');
            }
        };

        const cleanup = setupSubscription();
        return () => {
            cleanup.then(cleanupFn => cleanupFn?.());
        };
    }, [connection, merchantPubkey, isDevnet, processNewTransaction, queryClient]);

    // Style for scrollbar to ensure it's visible and usable
    const scrollbarStyle = {
        scrollbarWidth: "thin",
        scrollbarColor: "#333 #1C1C1C",
        msOverflowStyle: "auto",
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-bold">Payment History</h2>
                <div className="flex justify-center items-center h-32">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <span>{(error as Error).message}</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Payment History</h2>
                <button 
                    onClick={() => refetch()} 
                    className="btn btn-ghost btn-sm"
                >
                    Refresh
                </button>
            </div>
            {payments.length === 0 ? (
                <p className="text-gray-500">No payments received yet</p>
            ) : (
                <div 
                    className="payment-history-container" 
                    style={{ 
                        maxHeight: "400px", 
                        overflowY: "auto", 
                        paddingRight: "8px", 
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        scrollbarWidth: "thin",
                        scrollbarColor: "#333 #1C1C1C", 
                    }}
                >
                    {payments.map((payment) => (
                        <div 
                            key={payment.signature} 
                            className="card bg-[#1C1C1C] shadow flex-shrink-0"
                            style={{ marginBottom: "0" }}
                        >
                            <div className="card-body p-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-gray font-medium">
                                            +{formatUSDCAmount(payment.amount)} USDC
                                        </p>
                                        <p className="text-gray-400 text-sm">
                                            {new Date(payment.timestamp).toLocaleString()}
                                        </p>
                                        {payment.memo && payment.memo.length > 0 && (
                                            <p className="text-sm text-gray-300 mt-1">
                                                Memo: {payment.memo}
                                            </p>
                                        )}
                                        <a 
                                            href={formatSolscanDevnetLink(payment.signature)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-mint text-sm hover:opacity-80 block"
                                        >
                                            View on Solscan
                                        </a>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <p className="text-gray-400 text-sm">
                                            From: {payment.sender.toString().slice(0, 4)}...
                                            {payment.sender.toString().slice(-4)}
                                        </p>
                                        <RefundButton
                                            program={program}
                                            merchantPubkey={merchantPubkey}
                                            payment={{
                                                signature: payment.signature,
                                                amount: payment.amount,
                                                recipient: payment.sender
                                            }}
                                            onSuccess={() => queryClient.invalidateQueries({
                                                queryKey: ['payments', merchantPubkey.toString(), isDevnet]
                                            })}
                                            isDevnet={isDevnet}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 