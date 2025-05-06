'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js';
import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/lib/connection-context';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';
import { Program } from '@coral-xyz/anchor';
import { RefundButton } from './refund-button';
import type { Kumbaya } from '../../../anchor/target/types/kumbaya';
import { retryWithBackoff } from '@/utils/para';
import { useQueryClient } from '@tanstack/react-query';

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

export function PaymentHistory({ program, merchantPubkey, isDevnet = true, onBalanceUpdate }: PaymentHistoryProps) {
    const { data: wallet } = useWallet();
    const { connection } = useConnection();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const queryClient = useQueryClient();

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

    // Debug logging for memos
    useEffect(() => {
        payments.forEach(payment => {
            if (payment.memo) {
                console.log('Payment memo:', {
                    signature: payment.signature,
                    memo: payment.memo,
                    type: typeof payment.memo
                });
            }
        });
    }, [payments]);

    const fetchPayments = useCallback(async () => {
        try {
            setIsLoading(true);
            setError('');

            await retryWithBackoff(async () => {
                // Get the merchant's USDC ATA
                const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
                const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
                
                console.log('Fetching history for merchant:', {
                    merchantPubkey: merchantPubkey.toString(),
                    usdcMint: usdcMint.toString(),
                    merchantUsdcAta: merchantUsdcAta.toString(),
                    isDevnet
                });

                // First check if the ATA exists
                const ataInfo = await connection.getAccountInfo(merchantUsdcAta);
                if (!ataInfo) {
                    console.log('Merchant USDC ATA does not exist yet');
                    setPayments([]);
                    return;
                }

                // Get all signatures for the merchant's USDC ATA
                const signatures = await connection.getSignaturesForAddress(merchantUsdcAta, {
                    limit: 20
                });

                console.log('Found signatures:', signatures.map(sig => sig.signature));

                // Get the full transaction details for each signature
                const transactions = await Promise.all(
                    signatures.map(sig => 
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
                                    if ('info' in parsedData && parsedData.info) {
                                        destination = parsedData.info.destination;
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

                        // Extract memo from transaction logs
                        let memo = null;
                        if (tx.meta?.logMessages) {
                            console.log('Transaction logs for', tx.transaction.signatures[0], ':', tx.meta.logMessages);
                            
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
                                    console.log('Found memo:', memo);
                                } else {
                                    console.log('Could not extract memo from log:', memoLog);
                                }
                            } else {
                                console.log('No memo found in logs');
                            }
                        }

                        const payment = {
                            signature: tx.transaction.signatures[0],
                            amount: Number(amount) / Math.pow(10, 6),
                            memo,
                            timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                            sender: new PublicKey(authority)
                        };

                        console.log('Created payment object:', payment);
                        return payment;
                    }));

                const validPayments = processedPayments.filter((payment): payment is Payment => payment !== null);
                console.log('Final processed payments with memos:', validPayments);
                setPayments(validPayments);

                // Update balance if callback is provided
                if (onBalanceUpdate) {
                    const balance = await connection.getTokenAccountBalance(merchantUsdcAta);
                    onBalanceUpdate(Number(balance.value.uiAmount || 0));
                }
            }, 3, 2000);

        } catch (err) {
            console.error('Error fetching payments:', err);
            setError('Failed to fetch payment history');
            toast.error('Failed to fetch payment history');
        } finally {
            setIsLoading(false);
        }
    }, [connection, merchantPubkey, isDevnet, onBalanceUpdate]);

    // Add new function to process a single transaction
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
                console.log('Transaction logs for', signature, ':', tx.meta.logMessages);
                
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
                        console.log('Found memo:', memo);
                    } else {
                        console.log('Could not extract memo from log:', memoLog);
                    }
                } else {
                    console.log('No memo found in logs');
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

    // Initial fetch
    useEffect(() => {
        fetchPayments();

        // Set up subscription to merchant's USDC ATA
        const setupSubscription = async () => {
            try {
                const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;
                const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);

                // Subscribe to account changes
                const subscriptionId = connection.onAccountChange(
                    merchantUsdcAta,
                    async (_, context) => {
                        console.log('Detected change in merchant USDC ATA');
                        
                        // Get the latest transaction signature
                        const signatures = await connection.getSignaturesForAddress(merchantUsdcAta, {
                            limit: 1
                        });

                        if (signatures.length === 0) return;

                        const latestSignature = signatures[0].signature;
                        const newPayment = await processNewTransaction(latestSignature);

                        if (newPayment) {
                            setPayments(prevPayments => {
                                // Check if payment already exists
                                if (prevPayments.some(p => p.signature === newPayment.signature)) {
                                    return prevPayments;
                                }
                                // Add new payment to the top
                                return [newPayment, ...prevPayments];
                            });

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
                                duration: 5000,
                                position: 'bottom-right'
                            });

                            // Invalidate the merchant's USDC balance query
                            await queryClient.invalidateQueries({
                                queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet]
                            });

                            // Update balance if callback is provided
                            if (onBalanceUpdate) {
                                const balance = await connection.getTokenAccountBalance(merchantUsdcAta);
                                onBalanceUpdate(Number(balance.value.uiAmount || 0));
                            }
                        }
                    },
                    'confirmed'
                );

                // Cleanup subscription on unmount
                return () => {
                    console.log('Cleaning up USDC ATA subscription...');
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
    }, [fetchPayments, connection, merchantPubkey, isDevnet, processNewTransaction, onBalanceUpdate, queryClient]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-32">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Payment History</h2>
                <button 
                    onClick={() => fetchPayments()} 
                    className="btn btn-ghost btn-sm"
                >
                    Refresh
                </button>
            </div>
            {payments.length === 0 ? (
                <p className="text-gray-500">No payments received yet</p>
            ) : (
                <div className={`space-y-2 ${payments.length > 5 ? 'max-h-[500px] overflow-y-auto pr-2' : ''}`}>
                    {payments.map((payment) => (
                        <div key={payment.signature} className="card bg-[#1C1C1C] shadow mb-2">
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
                                            onSuccess={fetchPayments}
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