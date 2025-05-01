'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js';
import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/lib/connection-context';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';

interface PaymentHistoryProps {
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

export function PaymentHistory({ merchantPubkey, isDevnet = true, onBalanceUpdate }: PaymentHistoryProps) {
    const { data: wallet } = useWallet();
    const { connection } = useConnection();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Function to fetch payments using Solana's API
    const fetchPayments = useCallback(async () => {
        try {
            setIsLoading(true);
            setError('');

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
                setIsLoading(false);
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
            const processedPayments = transactions
                .filter((tx): tx is ParsedTransactionWithMeta => 
                    tx !== null && 
                    tx.meta !== null
                )
                .map(tx => {
                    // Log the full transaction for debugging
                    console.log('Processing transaction:', {
                        signature: tx.transaction.signatures[0],
                        instructions: tx.transaction.message.instructions
                    });

                    // Find the token transfer instruction that transfers TO the merchant's ATA
                    const transferInstruction = tx.transaction.message.instructions.find(
                        (instruction: ParsedInstruction | PartiallyDecodedInstruction) => {
                            // Log the raw instruction for debugging
                            console.log('Examining instruction:', instruction);

                            // Handle both parsed and partially decoded instructions
                            if ('parsed' in instruction) {
                                const { type, info } = instruction.parsed;
                                
                                // Check if it's a transfer or transferChecked instruction
                                const isTransferType = type === 'transfer' || type === 'transferChecked';
                                const isToMerchant = info.destination === merchantUsdcAta.toString();
                                
                                console.log('Checking parsed instruction:', {
                                    type,
                                    program: instruction.program,
                                    destination: info.destination,
                                    merchantAta: merchantUsdcAta.toString(),
                                    isTransferType,
                                    isToMerchant,
                                    authority: info.authority,
                                    info: info
                                });
                                
                                return isTransferType && isToMerchant;
                            } else {
                                // For partially decoded instructions, check if it's a token program instruction
                                const isTokenProgram = instruction.programId.toString() === TOKEN_PROGRAM_ID.toString();
                                
                                if (isTokenProgram) {
                                    console.log('Found token program instruction:', instruction);
                                    
                                    // Check if this is a transfer by examining the accounts
                                    const accounts = instruction.accounts || [];
                                    const isToMerchant = accounts.some(acc => acc.toString() === merchantUsdcAta.toString());
                                    
                                    if (isToMerchant) {
                                        console.log('Found potential transfer to merchant:', {
                                            accounts: accounts.map(acc => acc.toString()),
                                            data: instruction.data
                                        });
                                    }
                                    
                                    return isToMerchant;
                                }
                                return false;
                            }
                        }
                    );

                    if (!transferInstruction) {
                        console.log('No valid transfer instruction found in transaction:', tx.transaction.signatures[0]);
                        return null;
                    }

                    try {
                        let authority: string | undefined;
                        let amount: number | undefined;

                        if ('parsed' in transferInstruction) {
                            const { info } = transferInstruction.parsed;
                            authority = info.authority;
                            amount = Number(info.amount);
                        } else {
                            // For partially decoded instructions, try to get the authority from the accounts
                            // Typically, the authority (sender) is the first account in a transfer instruction
                            authority = transferInstruction.accounts[0]?.toString();
                            
                            // For partially decoded instructions, we need to parse the amount from the instruction data
                            // This depends on your specific program's instruction format
                            console.log('Partially decoded instruction data:', transferInstruction.data);
                        }

                        if (!authority || typeof authority !== 'string') {
                            console.log('Invalid or missing authority in transaction:', tx.transaction.signatures[0]);
                            return null;
                        }

                        // Create payment object with additional error handling
                        const payment = {
                            signature: tx.transaction.signatures[0],
                            amount: (amount || 0) / Math.pow(10, 6), // Convert from USDC decimals
                            memo: tx.meta?.logMessages?.find(log => log.includes('Memo:'))?.replace('Program log: Memo:', '').trim() || null,
                            timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
                            sender: new PublicKey(authority)
                        };
                        
                        console.log('Successfully processed payment:', payment);
                        return payment;
                    } catch (err) {
                        console.error('Error processing payment:', err, {
                            signature: tx.transaction.signatures[0],
                            instruction: transferInstruction
                        });
                        return null;
                    }
                })
                .filter((payment): payment is Payment => payment !== null);

            console.log('Final processed payments:', processedPayments);
            setPayments(processedPayments);

            // Update balance if callback is provided
            if (onBalanceUpdate) {
                try {
                    const balance = await connection.getTokenAccountBalance(merchantUsdcAta);
                    onBalanceUpdate(Number(balance.value.uiAmount || 0));
                } catch (err) {
                    console.error('Error fetching balance:', err);
                }
            }
        } catch (err) {
            console.error('Error fetching payments:', err);
            setError('Failed to fetch payment history');
            toast.error('Failed to fetch payment history');
        } finally {
            setIsLoading(false);
        }
    }, [connection, merchantPubkey, isDevnet, onBalanceUpdate]);

    // Initial fetch
    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

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
                <div className="space-y-2">
                    {payments.map((payment) => (
                        <div key={payment.signature} className="card bg-base-100 shadow">
                            <div className="card-body p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">
                                            +{payment.amount.toFixed(2)} USDC
                                        </p>
                                        {payment.memo && (
                                            <p className="text-sm text-gray-500">{payment.memo}</p>
                                        )}
                                        <p className="text-xs text-gray-400">
                                            {new Date(payment.timestamp).toLocaleString()}
                                        </p>
                                        <a 
                                            href={formatSolscanDevnetLink(payment.signature)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-mint hover:opacity-80"
                                        >
                                            View on Solscan
                                        </a>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        From: {payment.sender.toString().slice(0, 4)}...
                                        {payment.sender.toString().slice(-4)}
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