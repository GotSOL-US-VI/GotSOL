'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction, Connection } from '@solana/web3.js';
import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
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
    enablePagination?: boolean;
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
    lastKnownTimestamp?: number,
    beforeSignature?: string
): Promise<Payment[]> {
    if (!merchantPubkey || !connection) return [];
    
    try {
        // Get the merchant's USDC ATA
        const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
        const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
        console.log('🏪 Merchant USDC ATA:', merchantUsdcAta.toString());
        console.log('🪙 USDC Mint:', usdcMint.toString());
        
        // First check if the ATA exists
        const ataInfo = await connection.getAccountInfo(merchantUsdcAta);
        console.log('📊 ATA Account Info:', ataInfo ? 'EXISTS' : 'NOT FOUND');
        if (!ataInfo) {
            console.log('❌ Merchant USDC ATA does not exist');
            return [];
        }

        // Configure signature fetch - always fetch more initially to ensure we have enough data
        const fetchConfig: any = {
            limit: beforeSignature ? 5 : 20 // Fetch 20 for initial load, 5 for pagination
        };
        
        if (beforeSignature) {
            fetchConfig.before = beforeSignature;
        }

        const signatures = await connection.getSignaturesForAddress(merchantUsdcAta, fetchConfig);
        console.log('📝 Found signatures:', signatures.length, signatures.map(s => s.signature.slice(0, 8) + '...'));

        if (signatures.length === 0) {
            console.log('❌ No signatures found for merchant ATA');
            return [];
        }

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
        console.log('✅ Valid transactions:', validTransactions.length, 'out of', transactions.length);

        // Process transactions into payments
        const payments: Payment[] = [];
        
        for (const tx of validTransactions) {
            try {
                const blockTime = tx.blockTime ? tx.blockTime * 1000 : Date.now();
                
                // If we have a lastKnownTimestamp and this transaction is older, skip it
                // This enables incremental fetching
                if (lastKnownTimestamp && blockTime <= lastKnownTimestamp) {
                    console.log('⏭️ Skipping old transaction:', tx.transaction.signatures[0].slice(0, 8) + '...');
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

                if (transferInstructions.length === 0) {
                    console.log('❌ No matching transfer instructions for:', tx.transaction.signatures[0].slice(0, 8) + '...');
                    continue;
                }

                // Use the first matching instruction
                const transferInstruction = transferInstructions[0] as ParsedInstruction;
                
                const parsedData = typeof transferInstruction.parsed === 'string'
                    ? { type: transferInstruction.parsed }
                    : transferInstruction.parsed;

                if (!('info' in parsedData)) {
                    console.log('❌ No info in parsed data for:', tx.transaction.signatures[0].slice(0, 8) + '...');
                    continue;
                }

                const info = parsedData.info;
                const authority = info.authority || info.multisigAuthority || info.source;
                const amount = info.tokenAmount?.amount || info.amount;

                if (!authority || !amount) {
                    console.log('❌ Missing authority or amount for:', tx.transaction.signatures[0].slice(0, 8) + '...', { authority, amount });
                    continue;
                }

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

                const payment = {
                    signature: tx.transaction.signatures[0],
                    amount: Number(amount) / Math.pow(10, 6),
                    memo,
                    timestamp: blockTime,
                    sender: new PublicKey(authority)
                };
                
                console.log('💰 Processed payment:', payment.signature.slice(0, 8) + '...', payment.amount, 'USDC');
                payments.push(payment);
            } catch (err) {
                console.error('Error processing transaction:', err);
                // Continue to next transaction on error
            }
        }

        console.log('🎉 Final payments array:', payments.length, payments);
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
    forceRefresh,
    enablePagination = false
}: PaymentHistoryProps) {
    const { data: wallet } = useWallet();
    const { connection } = useConnection();
    const queryClient = useQueryClient();
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMorePayments, setHasMorePayments] = useState(true);
    // Default to collapsed for both variations
    const [isExpanded, setIsExpanded] = useState(false);

    // Set appropriate defaults based on pagination mode
    // Recent version (enablePagination=false): max 2 payments
    // Full version (enablePagination=true): max 5 payments initially
    const effectiveMaxPayments = useMemo(() => {
        if (maxPayments) return maxPayments;
        return enablePagination ? 5 : 2;
    }, [maxPayments, enablePagination]);

    // Use our custom payment cache hook for localStorage persistence
    const { savePaymentsToCache } = usePaymentCache(merchantPubkey, isDevnet);

    // Unified query key - no more fetchLimit, just one cache for all payment data
    const unifiedQueryKey = useMemo(() => ['payments', merchantPubkey?.toString(), isDevnet], [merchantPubkey, isDevnet]);

    // Use React Query to fetch and cache payment data with unified caching
    const { data: allPayments = [], isLoading, error, refetch } = useQuery({
        queryKey: unifiedQueryKey,
        queryFn: async () => {
            // Fetch initial payments (up to 20 signatures to ensure we have enough)
            console.log('🔍 Fetching payment data for merchant:', merchantPubkey?.toString());
            const newPayments = await fetchPaymentData(merchantPubkey!, connection, isDevnet);
            console.log('📦 Fetched payments:', newPayments.length, newPayments);
            return newPayments.sort((a, b) => b.timestamp - a.timestamp);
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

    // Determine if there might be more payments available
    useEffect(() => {
        if (enablePagination && allPayments) {
            // If we have fewer payments than expected for the initial load, there might still be more
            // Reset hasMorePayments to true when we have less than what we'd expect from a full fetch
            const expectedMinimum = effectiveMaxPayments;
            if (allPayments.length < expectedMinimum) {
                setHasMorePayments(true);
            }
        }
    }, [allPayments, effectiveMaxPayments, enablePagination]);

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

    // Filter payments based on effectiveMaxPayments for display
    const displayPayments = useMemo(() => {
        console.log('🎯 Processing display payments:');
        console.log('  - allPayments:', allPayments?.length || 0, allPayments);
        console.log('  - effectiveMaxPayments:', effectiveMaxPayments);
        console.log('  - enablePagination:', enablePagination);
        
        if (!allPayments || allPayments.length === 0) {
            console.log('  - No payments to display');
            return [];
        }
        
        // For recent version (enablePagination=false): show max 2
        // For full version (enablePagination=true): show max 5 initially, more when loaded
        const result = allPayments.slice(0, effectiveMaxPayments);
        console.log('  - Display payments result:', result.length, result);
        return result;
    }, [allPayments, effectiveMaxPayments]);

    // Generate display text based on actual usage
    const getDisplayText = () => {
        if (enablePagination) {
            const totalCount = allPayments.length;
            const displayCount = Math.min(displayPayments.length, effectiveMaxPayments);
            return `Showing ${displayCount} of ${totalCount}+ payments`;
        } else {
            return `Last ${displayPayments.length} payments`;
        }
    };

    // Load more payments function for pagination
    const loadMorePayments = useCallback(async () => {
        if (!enablePagination || !merchantPubkey || !connection || isLoadingMore) {
            return;
        }

        setIsLoadingMore(true);
        
        try {
            // Get the oldest payment signature from current data
            const currentPayments = allPayments;
            if (currentPayments.length === 0) {
                return;
            }

            const oldestPayment = currentPayments[currentPayments.length - 1];
            const beforeSignature = oldestPayment.signature;

            // Fetch older payments in batches of 5
            const olderPayments = await fetchPaymentData(merchantPubkey, connection, isDevnet, undefined, beforeSignature);

            // If we got no payments at all, we've reached the true end
            if (olderPayments.length === 0) {
                console.log('🏁 No more payments available - disabling load more');
                setHasMorePayments(false);
                return;
            }

            // Filter out any duplicates (shouldn't happen, but safety check)
            const existingSignatures = new Set(currentPayments.map(p => p.signature));
            const newPayments = olderPayments.filter(p => !existingSignatures.has(p.signature));
            
            // If all payments were duplicates, keep button active for retry
            if (newPayments.length === 0) {
                console.log('⚠️ All payments were duplicates - keeping button active');
                return;
            }

            // Combine and update the cache and query data
            const combinedPayments = [...currentPayments, ...newPayments];
            const sortedPayments = combinedPayments.sort((a, b) => b.timestamp - a.timestamp);
            
            savePaymentsToCache(sortedPayments);
            queryClient.setQueryData(['payments', merchantPubkey.toString(), isDevnet], sortedPayments);
            
            console.log(`✅ Successfully loaded ${newPayments.length} more payments`);
            
        } catch (error) {
            console.error('❌ Error loading more payments:', error);
            toastUtils.error('Failed to load more payments - click to retry');
            // Keep button active for retry - don't disable hasMorePayments on error
        } finally {
            setIsLoadingMore(false);
        }
    }, [enablePagination, merchantPubkey, connection, isDevnet, isLoadingMore, allPayments, savePaymentsToCache, queryClient]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="btn btn-ghost btn-sm"
                            title={isExpanded ? "Collapse payment history" : "Expand payment history"}
                        >
                            <svg 
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button 
                            className="btn btn-ghost btn-sm"
                            disabled={true}
                        >
                            <span className="loading loading-spinner loading-xs"></span>
                        </button>
                    </div>
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
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="btn btn-ghost btn-sm"
                        title={isExpanded ? "Collapse payment history" : "Expand payment history"}
                    >
                        <svg 
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
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
                    {isExpanded && (
                        <div className="text-xs text-gray-400 flex items-center">
                            <span>{getDisplayText()}</span>
                        </div>
                    )}
                </div>
            </div>
            
            {isExpanded && (
                <>
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
                                                <div 
                                                    className="text-gray font-medium group cursor-pointer"
                                                    title="Hover to reveal amount"
                                                >
                                                    <span className="group-hover:hidden">+•••••• USDC</span>
                                                    <span className="hidden group-hover:inline">+{formatUSDCAmount(payment.amount)} USDC</span>
                                                </div>
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
                            
                            {/* Load More button for pagination - show if we should have more payments or if we actually have more */}
                            {enablePagination && hasMorePayments && (
                                <div className="flex justify-center mt-4">
                                    <button 
                                        onClick={loadMorePayments}
                                        disabled={isLoadingMore}
                                        className="btn btn-outline btn-sm"
                                    >
                                        {isLoadingMore ? (
                                            <>
                                                <span className="loading loading-spinner loading-xs"></span>
                                                Loading more...
                                            </>
                                        ) : (
                                            'Load More (5)'
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}