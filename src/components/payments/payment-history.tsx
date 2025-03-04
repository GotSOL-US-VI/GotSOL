'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { RefundButton } from './refund-button';
import toast from 'react-hot-toast';

interface PaymentHistoryProps {
    program: Program<Idl>;
    merchantPubkey: PublicKey;
    isDevnet?: boolean;
}

interface Payment {
    signature: string;
    amount: number;
    memo: string | null;
    timestamp: number;
    recipient: PublicKey;
}

const BATCH_SIZE = 10;

const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export function PaymentHistory({ program, merchantPubkey, isDevnet = true }: PaymentHistoryProps) {
    const { connection } = useConnection();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasInitialData, setHasInitialData] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const lastSignatureRef = useRef<string | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout>();
    const seenPaymentsRef = useRef<Set<string>>(new Set());

    // Helper function to add payments while preventing duplicates and maintaining order
    const addPayments = (newPayments: Payment[], shouldNotify: boolean = false) => {
        setPayments(prev => {
            const uniquePayments = newPayments.filter(
                newPayment => !prev.some(p => p.signature === newPayment.signature)
            );
            
            // Show toast for new payments if shouldNotify is true
            if (shouldNotify) {
                uniquePayments.forEach(payment => {
                    if (!seenPaymentsRef.current.has(payment.signature)) {
                        toast.success(
                            `Received ${payment.amount.toFixed(6)} USDC${payment.memo ? ` - ${payment.memo}` : ''}`,
                            {
                                duration: 5000,
                                position: 'bottom-right',
                            }
                        );
                        seenPaymentsRef.current.add(payment.signature);
                    }
                });
            } else {
                // Add to seen payments without notification
                uniquePayments.forEach(payment => {
                    seenPaymentsRef.current.add(payment.signature);
                });
            }

            const updated = [...prev, ...uniquePayments];
            return updated.sort((a, b) => b.timestamp - a.timestamp);
        });
    };

    // Helper function to fetch transaction with retry
    const fetchTransactionWithRetry = async (signature: string, retries = 3, delay = 1000): Promise<ParsedTransactionWithMeta | null> => {
        for (let i = 0; i < retries; i++) {
            try {
                const tx = await connection.getParsedTransaction(signature);
                return tx;
            } catch (err) {
                if (i === retries - 1) return null;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    };

    // Function to process transactions into payments
    const processTransactions = (transactions: (ParsedTransactionWithMeta | null)[]): Payment[] => {
        return transactions
            .filter((tx): tx is ParsedTransactionWithMeta => tx !== null)
            .map(tx => {
                try {
                    console.log('Processing transaction:', {
                        signature: tx.transaction.signatures[0],
                        preBalances: tx.meta?.preTokenBalances,
                        postBalances: tx.meta?.postTokenBalances,
                        logs: tx.meta?.logMessages
                    });

                    // Find the merchant's token balance changes
                    const merchantPreBalance = tx.meta?.preTokenBalances?.find(b => 
                        b.owner === merchantPubkey.toString()
                    )?.uiTokenAmount.uiAmount || 0;

                    const merchantPostBalance = tx.meta?.postTokenBalances?.find(b => 
                        b.owner === merchantPubkey.toString()
                    )?.uiTokenAmount.uiAmount || 0;

                    const amount = merchantPostBalance - merchantPreBalance;

                    // Only process if there was a positive change in merchant's balance
                    if (amount <= 0) {
                        console.log('Skipping transaction - no positive balance change:', amount);
                        return null;
                    }

                    // Find the sender's public key (the account that sent the USDC)
                    const senderAccount = tx.meta?.preTokenBalances?.find(balance => 
                        balance.owner !== merchantPubkey.toString() && 
                        (balance.uiTokenAmount?.uiAmount ?? 0) > 0
                    );

                    const recipient = senderAccount?.owner 
                        ? new PublicKey(senderAccount.owner)
                        : tx.transaction.message.accountKeys[1].pubkey;

                    const payment = {
                        signature: tx.transaction.signatures[0],
                        amount,
                        memo: tx.meta?.logMessages?.find(log => log.includes('Program log: Memo'))?.split(': ')[2] || null,
                        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                        recipient,
                    };

                    console.log('Processed payment:', payment);
                    return payment;
                } catch (error) {
                    console.error('Error processing transaction:', error);
                    return null;
                }
            })
            .filter((payment): payment is Payment => payment !== null);
    };

    // Function to fetch payments
    const fetchPayments = async (beforeSignature?: string): Promise<Payment[]> => {
        try {
            const merchantUsdcAta = await getAssociatedTokenAddress(
                isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET,
                merchantPubkey,
                true
            );

            console.log('Fetching payments for ATA:', merchantUsdcAta.toString());

            const signatures = await connection.getSignaturesForAddress(
                merchantUsdcAta,
                { limit: BATCH_SIZE, before: beforeSignature }
            );

            console.log('Found signatures:', signatures.length);

            if (signatures.length === 0) {
                setHasMore(false);
                return [];
            }

            const transactions = await Promise.all(
                signatures.map(sig => fetchTransactionWithRetry(sig.signature))
            );

            console.log('Fetched transactions:', transactions.length);

            const newPayments = processTransactions(transactions);
            console.log('Processed payments:', newPayments);

            if (signatures.length > 0) {
                lastSignatureRef.current = signatures[signatures.length - 1].signature;
            }

            return newPayments;
        } catch (err) {
            console.error('Error fetching payments:', err);
            return [];
        }
    };

    // Function to load more payments
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const newPayments = await fetchPayments(lastSignatureRef.current || undefined);
        
        if (newPayments.length > 0) {
            addPayments(newPayments);
        } else {
            setHasMore(false);
        }
        
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore]);

    useEffect(() => {
        let subscriptionId: number | undefined;
        let isSubscribed = true;

        const setupPaymentListener = async () => {
            try {
                const merchantUsdcAta = await getAssociatedTokenAddress(
                    isDevnet
                        ? new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
                        : new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
                    merchantPubkey,
                    true
                );

                // Initial fetch
                const initialPayments = await fetchPayments();
                if (isSubscribed) {
                    addPayments(initialPayments, false); // Don't notify for initial load
                    setHasInitialData(true);
                    setIsLoading(false);
                }

                // Set up real-time listener
                subscriptionId = connection.onAccountChange(
                    merchantUsdcAta,
                    async (accountInfo) => {
                        try {
                            const recentSigs = await connection.getSignaturesForAddress(merchantUsdcAta, { limit: 1 });
                            if (recentSigs.length === 0) return;

                            const recentTx = await fetchTransactionWithRetry(recentSigs[0].signature);
                            if (!recentTx || !recentTx.meta) return;

                            const newPayments = processTransactions([recentTx]);
                            if (newPayments.length > 0 && isSubscribed) {
                                addPayments(newPayments, true); // Notify for new payments
                            }
                        } catch (err) {
                            console.error('Error processing new transaction:', err);
                        }
                    },
                    'confirmed'
                );
            } catch (err) {
                if (isSubscribed) {
                    retryTimeoutRef.current = setTimeout(setupPaymentListener, 2000);
                }
            }
        };

        setupPaymentListener();

        return () => {
            isSubscribed = false;
            if (subscriptionId) {
                connection.removeAccountChangeListener(subscriptionId);
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [connection, merchantPubkey, isDevnet]);

    return (
        <div className="bg-base-200 rounded-lg p-4 h-full overflow-y-auto w-full">
            <h2 className="text-xl font-bold mb-4">Payment History</h2>
            
            {!hasInitialData || isLoading ? (
                <div className="flex justify-center h-full items-center">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            ) : payments.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-500">
                    No payments received yet
                </div>
            ) : (
                <div className="space-y-3 h-full">
                    {payments.map((payment) => (
                        <div
                            key={payment.signature}
                            className="bg-base-100 p-4 rounded-lg shadow-sm"
                        >
                            <div className="flex justify-between items-start gap-2 flex-wrap">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="font-semibold text-lg">${payment.amount.toFixed(6)} USDC</div>
                                    {payment.memo && (
                                        <div className="text-base text-gray-500 mt-1 break-words">{payment.memo}</div>
                                    )}
                                    {/* <div className="text-sm text-gray-400 mt-2">
                                        To: {payment.recipient.toString().slice(0, 4)}...{payment.recipient.toString().slice(-4)}
                                    </div> */}
                                </div>
                                <div className="text-right min-w-[180px]">
                                    <div className="text-sm text-gray-500">
                                        {new Date(payment.timestamp).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {new Date(payment.timestamp).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                        })}
                                    </div>
                                    <div className="mt-3">
                                        <RefundButton
                                            program={program}
                                            merchantPubkey={merchantPubkey}
                                            payment={payment}
                                            onSuccess={() => {
                                                fetchPayments().then(newPayments => {
                                                    if (newPayments.length > 0) {
                                                        setPayments(newPayments);
                                                    }
                                                });
                                            }}
                                            isDevnet={isDevnet}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {hasMore && (
                        <div className="pt-4 text-center">
                            <button 
                                className="btn btn-outline btn-wide"
                                onClick={loadMore}
                                disabled={isLoadingMore}
                            >
                                {isLoadingMore ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    'Load More'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
} 