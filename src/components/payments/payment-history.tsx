'use client';

import { useConnection } from '@/lib/connection-context';
import { PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { RefundButton } from './refund-button';
import toast from 'react-hot-toast';

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

interface PaymentHistoryProps {
    program: Program<Idl>;
    merchantPubkey: PublicKey;
    isDevnet?: boolean;
    onBalanceUpdate?: (balance: number) => void;
}

interface Payment {
    signature: string;
    amount: number;
    memo: string | null;
    timestamp: number;
    recipient: PublicKey;
}

const BATCH_SIZE = 10;
const ACCOUNT_CHANGE_DEBOUNCE = 1000; // 1 second debounce for account changes

const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export function PaymentHistory({ program, merchantPubkey, isDevnet = true, onBalanceUpdate }: PaymentHistoryProps) {
    const { connection } = useConnection();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasInitialData, setHasInitialData] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const lastSignatureRef = useRef<string | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout>();
    const seenPaymentsRef = useRef<Set<string>>(new Set());
    const [isSubscribed, setIsSubscribed] = useState(true);
    const subscriptionIdRef = useRef<number>();
    const lastAccountUpdateRef = useRef<number>(0);
    const accountUpdateTimeoutRef = useRef<NodeJS.Timeout>();

    // Helper function to add payments while preventing duplicates and maintaining order
    const addPayments = useCallback((newPayments: Payment[], shouldNotify: boolean = false) => {
        // First, filter out payments that are already in the state
        setPayments(prev => {
            const uniquePayments = newPayments.filter(
                newPayment => !prev.some(p => p.signature === newPayment.signature)
            );
            
            // Add to seen payments without notification
            uniquePayments.forEach(payment => {
                seenPaymentsRef.current.add(payment.signature);
            });

            const updated = [...prev, ...uniquePayments];
            return updated.sort((a, b) => b.timestamp - a.timestamp);
        });
        
        // Show toast for new payments if shouldNotify is true - moved outside of setState
        if (shouldNotify) {
            newPayments.forEach(payment => {
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
        }
    }, []);

    // Helper function to fetch transaction with retry
    const fetchTransactionWithRetry = useCallback(async (signature: string, retries = 3, delay = 1000): Promise<ParsedTransactionWithMeta | null> => {
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
    }, [connection]);

    // Function to process transactions into payments
    const processTransactions = useCallback((transactions: (ParsedTransactionWithMeta | null)[]): Payment[] => {
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

                    // Check if this is an internal transfer (like compliance escrow)
                    // by looking at the logs for specific program calls
                    const isInternalTransfer = tx.meta?.logMessages?.some(log => 
                        log.includes('Program log: Instruction: WithdrawUsdc') || // Merchant withdrawal
                        log.includes('Program log: Instruction: RefundPayment') || // Refund
                        log.includes('Program log: Instruction: MakeRevenuePayment') // Tax payment
                    );

                    if (isInternalTransfer) {
                        console.log('Skipping internal transfer transaction');
                        return null;
                    }

                    // Find the sender's public key (the account that sent the USDC)
                    const senderAccount = tx.meta?.preTokenBalances?.find(balance => 
                        balance.owner !== merchantPubkey.toString() && 
                        (balance.uiTokenAmount?.uiAmount ?? 0) > 0
                    );

                    // Skip if we can't identify a valid external sender
                    if (!senderAccount) {
                        console.log('Skipping transaction - no valid external sender found');
                        return null;
                    }

                    const recipient = senderAccount.owner 
                        ? new PublicKey(senderAccount.owner)
                        : tx.transaction.message.accountKeys[1].pubkey;

                    const payment = {
                        signature: tx.transaction.signatures[0],
                        amount,
                        memo: tx.meta?.logMessages?.find(log => log.includes('Program log: Memo'))?.split(': ')[2]?.replace(/^"|"$/g, '') || null,
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
    }, [merchantPubkey]);

    // Function to fetch payments
    const fetchPayments = useCallback(async (beforeSignature?: string): Promise<Payment[]> => {
        try {
            const merchantUsdcAta = await findAssociatedTokenAddress(
                merchantPubkey,
                isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET
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
    }, [connection, isDevnet, merchantPubkey, fetchTransactionWithRetry, processTransactions]);

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
    }, [isLoadingMore, hasMore, fetchPayments, addPayments]);

    // Helper function to fetch balance
    const fetchBalance = useCallback(async (ata: PublicKey) => {
        try {
            const balance = await connection.getTokenAccountBalance(ata);
            return balance?.value?.uiAmount ?? 0;
        } catch (err) {
            console.error('Error fetching balance:', err);
            return 0;
        }
    }, [connection]);

    // Helper function to handle account updates with debouncing
    const handleAccountUpdate = useCallback(async (merchantUsdcAta: PublicKey) => {
        const now = Date.now();
        if (now - lastAccountUpdateRef.current < ACCOUNT_CHANGE_DEBOUNCE) {
            if (accountUpdateTimeoutRef.current) {
                clearTimeout(accountUpdateTimeoutRef.current);
            }
            accountUpdateTimeoutRef.current = setTimeout(() => {
                handleAccountUpdate(merchantUsdcAta);
            }, ACCOUNT_CHANGE_DEBOUNCE);
            return;
        }
        lastAccountUpdateRef.current = now;

        try {
            // Fetch new balance
            const balance = await fetchBalance(merchantUsdcAta);
            if (onBalanceUpdate) {
                onBalanceUpdate(balance);
            }

            // Fetch recent transaction
            const recentSigs = await connection.getSignaturesForAddress(merchantUsdcAta, { limit: 1 });
            if (recentSigs.length === 0) return;

            const recentTx = await fetchTransactionWithRetry(recentSigs[0].signature);
            if (!recentTx || !recentTx.meta) return;

            const newPayments = processTransactions([recentTx]);
            if (newPayments.length > 0 && isSubscribed) {
                addPayments(newPayments, true);
            }
        } catch (err) {
            console.error('Error handling account update:', err);
        }
    }, [connection, fetchBalance, onBalanceUpdate, fetchTransactionWithRetry, processTransactions, addPayments, isSubscribed]);

    const setupPaymentListener = useCallback(async () => {
        try {
            const merchantUsdcAta = await findAssociatedTokenAddress(
                merchantPubkey,
                isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET
            );

            // Initial fetch of balance and payments
            const balance = await fetchBalance(merchantUsdcAta);
            if (onBalanceUpdate) {
                onBalanceUpdate(balance);
            }

            const initialPayments = await fetchPayments();
            if (isSubscribed) {
                addPayments(initialPayments, false);
                setHasInitialData(true);
                setIsLoading(false);
            }

            // Set up real-time listener with debouncing
            subscriptionIdRef.current = connection.onAccountChange(
                merchantUsdcAta,
                () => {
                    handleAccountUpdate(merchantUsdcAta);
                },
                'confirmed'
            );
        } catch (error) {
            console.error('Error setting up payment listener:', error);
            if (isSubscribed) {
                retryTimeoutRef.current = setTimeout(setupPaymentListener, 5000); // Increased retry delay
            }
        }
    }, [connection, merchantPubkey, isDevnet, fetchBalance, onBalanceUpdate, fetchPayments, addPayments, handleAccountUpdate, isSubscribed]);

    useEffect(() => {
        setIsSubscribed(true);
        setupPaymentListener();

        return () => {
            setIsSubscribed(false);
            if (subscriptionIdRef.current) {
                connection.removeAccountChangeListener(subscriptionIdRef.current);
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            if (accountUpdateTimeoutRef.current) {
                clearTimeout(accountUpdateTimeoutRef.current);
            }
        };
    }, [connection, merchantPubkey, isDevnet, setupPaymentListener]);

    return (
        <div className="bg-base-200 rounded-lg p-4 h-full w-full">
            <h2 className="text-xl font-bold mb-4">Payment History</h2>
            
            {!hasInitialData || isLoading ? (
                <div className="flex justify-center items-center">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            ) : payments.length === 0 ? (
                <div className="flex justify-center items-center text-gray-500">
                    No payments received yet
                </div>
            ) : (
                <div className="space-y-3 h-full">
                    {payments.map((payment) => (
                        <div
                            key={payment.signature}
                            className="bg-base-100 p-4 rounded-lg"
                            style={{ border: '1px solid rgba(137, 248, 203, 0.1)' }}
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
                                                setTimeout(() => {
                                                    fetchPayments().then(newPayments => {
                                                        if (newPayments.length > 0) {
                                                            setPayments(newPayments);
                                                        }
                                                    });
                                                }, 0);
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