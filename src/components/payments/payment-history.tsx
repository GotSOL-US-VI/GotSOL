'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction, Connection } from '@solana/web3.js';
import { useEffect, useCallback, useRef, useMemo } from 'react';
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

interface PaymentHistoryProps {
    program: Program<Gotsol>;
    merchantPubkey: PublicKey;
    isDevnet?: boolean;
    onBalanceUpdate?: (balance: number) => void;
    onPaymentReceived?: () => void;
    title?: string;
    maxPayments?: number;
    forceRefresh?: React.MutableRefObject<(() => Promise<void>) | null>;
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
    isDevnet: boolean = true,
    lastKnownTimestamp?: number
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

        // Always fetch a reasonable amount for the unified cache
        // If we have a lastKnownTimestamp, we'll filter after fetching
        const signatures = await connection.getSignaturesForAddress(merchantUsdcAta, {
            limit: 50 // Unified fetch limit
        });

        // Process signatures in batches with optimized settings
        const transactions = await batchProcess<{signature: string}, ParsedTransactionWithMeta | null>(
            signatures,
            3, // Consistent batch size
            async (sig) => connection.getParsedTransaction(sig.signature, 'confirmed'),
            400 // Moderate delay
        );

        // Process and filter the transactions
        const validTransactions = transactions.filter((tx): tx is ParsedTransactionWithMeta => 
            tx !== null && tx.meta !== null
        );

        // Process transactions into payments
        const payments: Payment[] = [];
        
        for (const tx of validTransactions) {
            try {
                const blockTime = tx.blockTime ? tx.blockTime * 1000 : Date.now();
                
                // If we have a lastKnownTimestamp and this transaction is older, skip it
                // This enables incremental fetching
                if (lastKnownTimestamp && blockTime <= lastKnownTimestamp) {
                    continue;
                }

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
                    timestamp: blockTime,
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

export function PaymentHistory({ 
    program, 
    merchantPubkey, 
    isDevnet = true, 
    onBalanceUpdate, 
    onPaymentReceived,
    title = 'Payment History',
    maxPayments,
    forceRefresh
}: PaymentHistoryProps) {
    const { data: wallet } = useWallet();
    const { connection } = useConnection();
    const queryClient = useQueryClient();
    
    // Use our custom payment cache hook for localStorage persistence
    const { savePaymentsToCache } = usePaymentCache(merchantPubkey, isDevnet);

    // Unified query key - no more fetchLimit, just one cache for all payment data
    const unifiedQueryKey = useMemo(() => ['payments', merchantPubkey?.toString(), isDevnet], [merchantPubkey, isDevnet]);

    // Use React Query to fetch and cache payment data with unified caching
    const { data: allPayments = [], isLoading, error, refetch } = useQuery({
        queryKey: unifiedQueryKey,
        queryFn: async () => {
            // Check if we have existing cached data to enable incremental fetching
            const existingPayments = queryClient.getQueryData<Payment[]>(unifiedQueryKey) || [];
            const lastKnownTimestamp = existingPayments.length > 0 
                ? Math.max(...existingPayments.map(p => p.timestamp))
                : undefined;

            const newPayments = await fetchPaymentData(merchantPubkey!, connection, isDevnet, lastKnownTimestamp);
            
            // If we got new payments, merge them with existing ones
            if (newPayments.length > 0 && existingPayments.length > 0) {
                // Combine and deduplicate by signature, sort by timestamp desc
                const combined = [...newPayments, ...existingPayments];
                const unique = combined.filter((payment, index, arr) => 
                    arr.findIndex(p => p.signature === payment.signature) === index
                );
                return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50); // Keep latest 50
            }
            
            // If no existing data or no new payments, return what we got
            return newPayments.length > 0 ? newPayments : existingPayments;
        },
        enabled: !!merchantPubkey && !!connection,
        staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes  
        refetchOnWindowFocus: false, // Disable refetch on window focus to reduce API calls
        refetchOnMount: true, // Only refetch on mount if data is stale
        refetchInterval: false, // Disable automatic polling
        retry: (failureCount, error) => {
            // Don't retry on certain errors to avoid excessive API calls
            if (error && typeof error === 'object' && 'status' in error) {
                const status = (error as any).status;
                if (status === 429 || status === 403) return false; // Rate limiting or forbidden
            }
            return failureCount < 2; // Reduced retry attempts from 3 to 2
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
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

    // Fetch and update balance when needed - use correct query key structure
    const { data: balance } = useQuery({
        queryKey: ['token-balance', merchantPubkey.toString(), (isDevnet ? USDC_DEVNET_MINT : USDC_MINT).toString()],
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
    
    // Save payments to localStorage when they actually change (not just reference change)
    const previousPaymentsRef = useRef<Payment[]>([]);
    useEffect(() => {
        // Only save if the payments data has actually changed
        if (allPayments && allPayments.length > 0) {
            // Compare actual data, not just references
            const hasChanged = allPayments.length !== previousPaymentsRef.current.length ||
                allPayments.some((payment, index) => {
                    const prevPayment = previousPaymentsRef.current[index];
                    return !prevPayment || payment.signature !== prevPayment.signature;
                });
            
            if (hasChanged) {
                savePaymentsToCache(allPayments);
                previousPaymentsRef.current = allPayments;
            }
        }
    }, [allPayments, savePaymentsToCache]);
    
    // Process a single transaction (for live updates)
    const processNewTransaction = useCallback(async (signature: string): Promise<Payment | null> => {
        try {
            // Check if we already have this payment in the unified cache
            const existingPayments = queryClient.getQueryData<Payment[]>(unifiedQueryKey) || [];
            
            // Skip processing if we already have this signature
            if (existingPayments.some(p => p.signature === signature)) {
                return null;
            }
            
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
    }, [connection, merchantPubkey, isDevnet, queryClient, unifiedQueryKey]);

    // Set up subscription to merchant's USDC ATA for real-time updates
    const subscriptionRef = useRef<number | null>(null);
    const lastInvalidationTime = useRef<number>(0);
    
    useEffect(() => {
        if (!merchantPubkey || !connection) return;

        let isSubscribed = true;

        const setupSubscription = async () => {
            try {
                const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
                const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

                const subscriptionId = connection.onAccountChange(
                    merchantUsdcAta,
                    async (_accountInfo, _context) => {
                        // Aggressive debouncing - only invalidate payment history every 5 minutes
                        const now = Date.now();
                        const timeSinceLastInvalidation = now - lastInvalidationTime.current;
                        const PAYMENT_HISTORY_INVALIDATION_DELAY = 5 * 60 * 1000; // 5 minutes
                        
                        setTimeout(async () => {
                            // Only invalidate if we're still mounted and subscribed
                            if (isSubscribed && subscriptionRef.current === subscriptionId) {
                                // Only invalidate balance queries frequently, payment history less frequently
                                const balanceInvalidations = [
                                    // Invalidate specific USDC balance for the merchant using correct query key
                                    queryClient.invalidateQueries({
                                        queryKey: ['token-balance', merchantPubkey.toString(), (isDevnet ? USDC_DEVNET_MINT : USDC_MINT).toString()],
                                        refetchType: 'active' // Only refetch active queries
                                    }),
                                    
                                    // Legacy query key (if still needed)
                                    queryClient.invalidateQueries({
                                        queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet],
                                        refetchType: 'active'
                                    })
                                ];
                                
                                await Promise.all(balanceInvalidations);
                                
                                // Only invalidate payment history if enough time has passed
                                if (timeSinceLastInvalidation > PAYMENT_HISTORY_INVALIDATION_DELAY) {
                                    lastInvalidationTime.current = now;
                                    
                                    await queryClient.invalidateQueries({
                                        predicate: (query) => {
                                            const [queryType, merchantId, devnet] = query.queryKey;
                                            return queryType === 'payments' && 
                                                   merchantId === merchantPubkey.toString() && 
                                                   devnet === isDevnet;
                                        },
                                        refetchType: 'active'
                                    });
                                }
                            }
                        }, 2000); // Increased delay to 2 seconds for better debouncing
                    },
                    { commitment: 'confirmed' }
                );

                subscriptionRef.current = subscriptionId;

                // Cleanup subscription on unmount
                return () => {
                    isSubscribed = false;
                    if (subscriptionRef.current === subscriptionId) {
                        connection.removeAccountChangeListener(subscriptionId);
                        subscriptionRef.current = null;
                    }
                };
            } catch (error) {
                console.error('Error setting up balance subscription:', error);
            }
        };

        setupSubscription();

        return () => {
            isSubscribed = false;
            if (subscriptionRef.current) {
                connection.removeAccountChangeListener(subscriptionRef.current);
                subscriptionRef.current = null;
            }
        };
    }, [merchantPubkey, connection, isDevnet, queryClient]);

    // Register force refresh function with forceRefresh ref if provided
    useEffect(() => {
        if (forceRefresh) {
            forceRefresh.current = async () => {
                await refetch();
            };
        }
    }, [forceRefresh, refetch]);

    // Filter payments based on maxPayments
    const displayPayments = maxPayments ? allPayments.slice(0, maxPayments) : allPayments;

    // Generate display text based on actual usage
    const getDisplayText = () => {
        if (maxPayments) {
            return `Last ${maxPayments} payments`;
        } else {
            return `Last ${allPayments.length} payments`;
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-bold">{title}</h2>
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
                <h2 className="text-xl font-bold">{title}</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => refetch()} 
                        className="btn btn-ghost btn-sm"
                        disabled={isLoading}
                        title="Manually refresh payment history (reduced automatic updates to save API calls)"
                    >
                        {isLoading ? (
                            <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                            'Refresh'
                        )}
                    </button>
                    <div className="text-xs text-gray-400 flex items-center">
                        <span>{getDisplayText()}</span>
                    </div>
                </div>
            </div>
            {!displayPayments || displayPayments.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No payments received yet</p>
                    <p className="text-xs text-gray-400">Payments will appear here when customers pay</p>
                </div>
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
                    {displayPayments.map((payment: Payment) => (
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
                                            onSuccess={() => {
                                                // Remove redundant invalidation since RefundButton already invalidates
                                                // This prevents double API calls after refunds
                                                // queryClient.invalidateQueries({
                                                //     queryKey: ['payments', merchantPubkey.toString(), isDevnet]
                                                // })
                                                
                                                // Optional: Show success feedback without triggering refetch
                                                console.log('Refund completed successfully');
                                            }}
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