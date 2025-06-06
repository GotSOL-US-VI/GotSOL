'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction, Connection } from '@solana/web3.js';
import { useEffect, useCallback, useState } from 'react';
import { useConnection } from '@/lib/connection-context';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { toastUtils } from '@/utils/toast-utils';
import { Program } from '@coral-xyz/anchor';
import { RefundButton } from './refund-button';
import type { Gotsol } from '@/utils/gotsol-exports';
import { retryWithBackoff } from '@/utils/para';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePaymentCache } from '@/hooks/use-payment-cache';
import { USDC_MINT, USDC_DEVNET_MINT, findAssociatedTokenAddress, formatUSDCAmount } from '@/utils/token-utils';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';

interface PaymentHistoryProps {
    program: Program<Gotsol>;
    merchantPubkey: PublicKey;
    isDevnet?: boolean;
    onBalanceUpdate?: (balance: number) => void;
    onPaymentReceived?: () => void;
}

interface Payment {
    signature: string;
    amount: number;
    memo: string | null;
    timestamp: number;
    sender: PublicKey;
}

interface ParsedInstructionWithInfo extends ParsedInstruction {
    parsed: {
        type: string;
        info: {
            authority?: string;
            multisigAuthority?: string;
            source?: string;
            destination?: string;
            amount?: string;
            tokenAmount?: {
                amount: string;
                decimals: number;
                uiAmount: number;
            };
        };
    };
}

interface TransactionSignatureResult {
    signature: string;
}

// Utility to batch requests to avoid rate limiting
const batchProcess = async <T, R>(
    items: T[],
    batchSize: number,
    processFn: (item: T) => Promise<R>,
    delayMs: number = 200
): Promise<R[]> => {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Process items in current batch concurrently
        const batchResults = await Promise.all(batch.map(processFn));
        results.push(...batchResults);
        
        // Add delay before next batch if not the last batch
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return results;
};

// Function to fetch payment data that can be used with React Query
async function fetchPaymentData(
    merchantPubkey: PublicKey, 
    connection: Connection, 
    isDevnet: boolean = true
): Promise<Payment[]> {
    if (!merchantPubkey || !connection) return [];
    
    try {
        // Get the merchant's USDC ATA
        const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
        const merchantStablecoinAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
        
        // First check if the ATA exists
        const ataInfo = await connection.getAccountInfo(merchantStablecoinAta);
        if (!ataInfo) {
            return [];
        }

        // Get all signatures for the merchant's USDC ATA
        const signatures = await connection.getSignaturesForAddress(merchantStablecoinAta, {
            limit: 250
        });

        // Process signatures in batches to avoid rate limiting
        const transactions = await batchProcess<{signature: string}, ParsedTransactionWithMeta | null>(
            signatures,
            5, // Process 5 transactions at a time
            async (sig) => connection.getParsedTransaction(sig.signature, 'confirmed'),
            300 // Wait 300ms between batches
        );

        // Process and filter the transactions
        const validTransactions = transactions.filter((tx): tx is ParsedTransactionWithMeta => 
            tx !== null && tx.meta !== null
        );

        // Process transactions into payments (avoiding additional network calls)
        const payments: Payment[] = [];
        
        for (const tx of validTransactions) {
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

                        return destination === merchantStablecoinAta.toString();
                    }
                );

                if (transferInstructions.length === 0) continue;

                // Use the first matching instruction
                const transferInstruction = transferInstructions[0] as ParsedInstruction;
                
                const parsedData = typeof transferInstruction.parsed === 'string'
                    ? { type: transferInstruction.parsed }
                    : transferInstruction.parsed;

                if (!('info' in parsedData)) continue;

                const info = parsedData.info;
                const authority = info.authority || info.multisigAuthority || info.source;
                const amount = info.tokenAmount?.amount || info.amount;

                if (!authority || !amount) continue;

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

                payments.push({
                    signature: tx.transaction.signatures[0],
                    amount: Number(amount) / Math.pow(10, 6),
                    memo,
                    timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                    sender: new PublicKey(authority)
                });
            } catch (err) {
                console.error('Error processing transaction:', err);
                // Continue to next transaction on error
            }
        }

        return payments;
    } catch (error) {
        console.error('Error fetching payments:', error);
        throw new Error('Failed to fetch payment history');
    }
}

export function PaymentHistory({ program, merchantPubkey, isDevnet = true, onBalanceUpdate, onPaymentReceived }: PaymentHistoryProps) {
    const { data: wallet } = useWallet();
    const { connection } = useConnection();
    const queryClient = useQueryClient();
    const { isBalancesVisible } = useBalanceVisibility();
    
    // State to track which payment cards are locked open (by signature)
    const [lockedPayments, setLockedPayments] = useState<Set<string>>(new Set());
    
    // Use our custom payment cache hook for localStorage persistence
    const { savePaymentsToCache } = usePaymentCache(merchantPubkey, isDevnet);

    // Use React Query for payment data with caching
    const { 
        data: payments = [],
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['payments', merchantPubkey.toString(), isDevnet],
        queryFn: () => retryWithBackoff(() => fetchPaymentData(merchantPubkey, connection, isDevnet), 3, 2000),
        staleTime: 10 * 60 * 1000, // Data stays fresh for 10 minutes
        gcTime: 60 * 60 * 1000, // Cache retained for 60 minutes
        refetchOnWindowFocus: false, // Only refetch on explicit refresh
        refetchOnMount: false, // Don't refetch automatically on mount
        refetchOnReconnect: false, // Don't refetch automatically on reconnect
        retry: 2, // Limit retries to reduce request load
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff with max 10s
        enabled: !!merchantPubkey && !!connection,
        structuralSharing: true, // Enable structural sharing for better performance
    });

    // Use React Query for fetching balance
    const fetchBalance = useCallback(async () => {
        if (!merchantPubkey || !connection) return 0;
        
        try {
            const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
            const merchantStablecoinAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
            const balance = await connection.getTokenAccountBalance(merchantStablecoinAta).catch(() => null);
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
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false, // Only refetch on explicit refresh
        refetchOnMount: false, // Don't refetch automatically on mount
        retry: 2, // Limit retries
        enabled: !!merchantPubkey && !!connection,
    });

    // Update balance via callback when it changes
    useEffect(() => {
        if (onBalanceUpdate && typeof balance === 'number') {
            onBalanceUpdate(balance);
        }
    }, [balance, onBalanceUpdate]);
    
    // Save payments to localStorage when they change
    useEffect(() => {
        if (payments && payments.length > 0) {
            savePaymentsToCache(payments);
        }
    }, [payments, savePaymentsToCache]);
    
    // Process a single transaction (for live updates)
    const processNewTransaction = useCallback(async (signature: string): Promise<Payment | null> => {
        try {
            // Check if we already have this payment in the cache
            const existingPayments = queryClient.getQueryData<Payment[]>(
                ['payments', merchantPubkey.toString(), isDevnet]
            ) || [];
            
            // Skip processing if we already have this signature
            if (existingPayments.some(p => p.signature === signature)) {
                return null;
            }
            
            const tx = await connection.getParsedTransaction(signature, 'confirmed');
            if (!tx || !tx.meta) return null;

            const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
            const merchantStablecoinAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

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

                        return destination === merchantStablecoinAta.toString();
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
    }, [connection, merchantPubkey, isDevnet, queryClient]);

    // Set up subscription to merchant's USDC ATA for real-time updates
    useEffect(() => {
        if (!merchantPubkey || !connection) return;

        // Keep track of already processed signatures to avoid duplicates
        const processedSignatures = new Set<string>();
        
        const setupSubscription = async () => {
            try {
                const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
                const merchantStablecoinAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

                // Prefill the processed signatures set with existing payment signatures
                const existingPayments = queryClient.getQueryData<Payment[]>(
                    ['payments', merchantPubkey.toString(), isDevnet]
                ) || [];
                existingPayments.forEach(p => processedSignatures.add(p.signature));

                console.log(`Setting up subscription for merchant ATA: ${merchantStablecoinAta.toString()}`);

                // Subscribe to account changes
                const subscriptionId = connection.onAccountChange(
                    merchantStablecoinAta,
                    // Add explicit types to callback parameters
                    async (_accountInfo, _context) => {
                        // Add a small delay to avoid rate limiting
                        await new Promise<void>(resolve => setTimeout(resolve, 100));
                        
                        // Get the latest transaction signature
                        const signatures = await connection.getSignaturesForAddress(merchantStablecoinAta, {
                            limit: 1
                        }) as TransactionSignatureResult[];

                        if (signatures.length === 0) return;

                        const latestSignature = signatures[0].signature;
                        
                        // Skip if we already processed this signature
                        if (processedSignatures.has(latestSignature)) {
                            return;
                        }
                        
                        // Add to processed list to avoid duplicates
                        processedSignatures.add(latestSignature);
                        
                        const newPayment = await processNewTransaction(latestSignature);

                        if (newPayment) {
                            // Use queryClient to update the cached payment data
                            queryClient.setQueryData(
                                ['payments', merchantPubkey.toString(), isDevnet],
                                (oldData: Payment[] = []) => {
                                    // Add new payment to the top
                                    const updatedPayments = [newPayment, ...oldData];
                                    
                                    // Also save to localStorage
                                    savePaymentsToCache(updatedPayments);
                                    
                                    return updatedPayments;
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
                            toastUtils.success(toastMessage, {
                                position: 'bottom-right'
                            });
                            
                            // Trigger the reset callback if provided
                            if (onPaymentReceived) {
                                onPaymentReceived();
                            }

                            // Invalidate all balance-related queries to ensure UI updates everywhere
                            await Promise.all([
                                // Invalidate specific USDC balance for the merchant
                                queryClient.invalidateQueries({
                                    queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet],
                                    refetchType: 'active' // Force immediate refetch
                                }),
                                
                                // Invalidate general token balances
                                queryClient.invalidateQueries({
                                    queryKey: ['token-balance'],
                                    refetchType: 'active'
                                }),
                                
                                // Ensure we refetch the data
                                queryClient.refetchQueries({
                                    queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet]
                                })
                            ]);
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
                toastUtils.error('Failed to set up real-time updates');
                return () => {}; // Return empty cleanup function
            }
        };

        const cleanup = setupSubscription();
        return () => {
            cleanup.then(cleanupFn => cleanupFn?.());
        };
    }, [connection, merchantPubkey, isDevnet, processNewTransaction, queryClient, savePaymentsToCache, onPaymentReceived]);

    // Function to toggle lock state for a specific payment
    const togglePaymentLock = (signature: string) => {
        setLockedPayments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(signature)) {
                newSet.delete(signature);
            } else {
                newSet.add(signature);
            }
            return newSet;
        });
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
            {!payments || payments.length === 0 ? (
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
                        gap: "12px"
                    }}
                >
                    {payments.map((payment: Payment) => {
                        const isLocked = lockedPayments.has(payment.signature);
                        const shouldShowAmount = isBalancesVisible || isLocked;
                        
                        return (
                        <div 
                            key={payment.signature} 
                            className="card bg-[#1C1C1C] shadow flex-shrink-0"
                            style={{ marginBottom: "0" }}
                        >
                            <div className="card-body p-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-gray font-medium">
                                            {shouldShowAmount ? (
                                                <span 
                                                    className="cursor-pointer select-none"
                                                    onClick={() => togglePaymentLock(payment.signature)}
                                                    title={isLocked ? "Click to unlock and hide amount" : "Click to lock amount visible"}
                                                >
                                                    +{formatUSDCAmount(payment.amount)} USDC {isLocked}
                                                </span>
                                            ) : (
                                                <span 
                                                    className="cursor-pointer hover:opacity-75 transition-opacity select-none"
                                                    title={`+${formatUSDCAmount(payment.amount)} USDC - Click to lock visible`}
                                                    onClick={() => togglePaymentLock(payment.signature)}
                                                    onMouseEnter={(e) => {
                                                        // Only show on hover if not locked
                                                        if (!isLocked) {
                                                            e.currentTarget.textContent = `+${formatUSDCAmount(payment.amount)} USDC`;
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        // Only hide on mouse leave if not locked
                                                        if (!isLocked) {
                                                            e.currentTarget.textContent = '+••••••• USDC';
                                                        }
                                                    }}
                                                >
                                                    +••••••• USDC
                                                </span>
                                            )}
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
                        );
                    })}
                </div>
            )}
        </div>
    );
} 