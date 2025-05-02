'use client';

import { useWallet } from '@getpara/react-sdk';
import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js';
import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/lib/connection-context';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from 'react-hot-toast';
import { Program, Idl } from '@coral-xyz/anchor';
import { RefundButton } from './refund-button';
import type { Kumbaya } from '../../../anchor/target/types/kumbaya';
import { retryWithBackoff } from '@/utils/para';

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
                                    // Skip non-token instructions
                                    if (instruction.program !== 'spl-token') {
                                        return false;
                                    }

                                    // Log the full parsed instruction for debugging
                                    console.log('Full parsed instruction:', JSON.stringify(instruction.parsed, null, 2));

                                    // Ensure we have the parsed info object
                                    if (!instruction.parsed || typeof instruction.parsed !== 'object') {
                                        return false;
                                    }

                                    // Handle both string type and object parsed data
                                    const parsedData = typeof instruction.parsed === 'string' 
                                        ? { type: instruction.parsed } 
                                        : instruction.parsed;

                                    // Check if we have the required info
                                    if (!('type' in parsedData)) {
                                        console.log('Missing type in parsed instruction:', parsedData);
                                        return false;
                                    }

                                    const { type } = parsedData;
                                    
                                    // Check if it's a transfer or transferChecked instruction
                                    const isTransferType = type === 'transfer' || type === 'transferChecked';
                                    if (!isTransferType) {
                                        return false;
                                    }

                                    // For transferChecked instructions, the structure might be different
                                    let destination: string | undefined;
                                    let authority: string | undefined;
                                    let amount: string | undefined;

                                    if ('info' in parsedData && parsedData.info) {
                                        // Standard token instruction format
                                        const info = parsedData.info;
                                        destination = info.destination;
                                        
                                        // Handle different authority fields
                                        authority = info.authority || info.multisigAuthority || info.source;
                                        
                                        // Handle different amount formats
                                        if (info.tokenAmount) {
                                            amount = info.tokenAmount.amount;
                                        } else if (info.amount) {
                                            amount = info.amount;
                                        }
                                    } else if ('source' in parsedData) {
                                        // Alternative format sometimes used
                                        destination = parsedData.destination;
                                        authority = parsedData.source;
                                        amount = parsedData.amount;
                                    }

                                    if (!destination) {
                                        console.log('Missing destination in transfer instruction:', parsedData);
                                        return false;
                                    }

                                    const isToMerchant = destination === merchantUsdcAta.toString();
                                    
                                    console.log('Checking parsed instruction:', {
                                        type,
                                        program: instruction.program,
                                        destination,
                                        authority,
                                        amount,
                                        merchantAta: merchantUsdcAta.toString(),
                                        isTransferType,
                                        isToMerchant,
                                        rawParsedData: parsedData
                                    });
                                    
                                    // Store the extracted data in the instruction for later use
                                    (instruction as any)._extractedData = {
                                        authority,
                                        amount,
                                        destination
                                    };
                                    
                                    return isTransferType && isToMerchant;
                                } else {
                                    // For partially decoded instructions, check if it's a token program instruction
                                    const isTokenProgram = instruction.programId.toString() === TOKEN_PROGRAM_ID.toString();
                                    
                                    if (!isTokenProgram) {
                                        return false;
                                    }

                                    // Check if this is a transfer by examining the accounts
                                    const accounts = instruction.accounts || [];
                                    if (accounts.length === 0) {
                                        return false;
                                    }

                                    const isToMerchant = accounts.some(acc => 
                                        acc && acc.toString() === merchantUsdcAta.toString()
                                    );
                                    
                                    if (isToMerchant) {
                                        console.log('Found potential transfer to merchant:', {
                                            accounts: accounts.map(acc => acc.toString()),
                                            data: instruction.data
                                        });
                                    }
                                    
                                    return isToMerchant;
                                }
                            }
                        );

                        if (!transferInstruction) {
                            console.log('No valid transfer instruction found in transaction:', tx.transaction.signatures[0]);
                            return null;
                        }

                        try {
                            let authority: string | undefined;
                            let amount: string | undefined;

                            if ('parsed' in transferInstruction) {
                                // Get the data we extracted earlier
                                const extractedData = (transferInstruction as any)._extractedData;
                                authority = extractedData?.authority;
                                amount = extractedData?.amount;

                                // Additional logging for debugging
                                console.log('Extracted transfer data:', {
                                    authority,
                                    amount,
                                    rawInstruction: transferInstruction.parsed
                                });
                            } else {
                                // For partially decoded instructions, try to get the authority from the accounts
                                authority = transferInstruction.accounts[0]?.toString();
                                console.log('Partially decoded instruction data:', {
                                    accounts: transferInstruction.accounts.map(acc => acc.toString()),
                                    data: transferInstruction.data
                                });
                            }

                            if (!authority) {
                                console.log('Invalid or missing authority in transaction:', tx.transaction.signatures[0], {
                                    instruction: transferInstruction,
                                    parsed: 'parsed' in transferInstruction ? transferInstruction.parsed : undefined
                                });
                                return null;
                            }

                            // Create payment object with additional error handling
                            const payment = {
                                signature: tx.transaction.signatures[0],
                                amount: amount ? Number(amount) / Math.pow(10, 6) : 0, // Convert from USDC decimals
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
                    const balance = await connection.getTokenAccountBalance(merchantUsdcAta);
                    onBalanceUpdate(Number(balance.value.uiAmount || 0));
                }
            }, 3, 2000); // 3 retries, starting with 2 second delay

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
                <div className={`space-y-2 ${payments.length > 5 ? 'max-h-[500px] overflow-y-auto pr-2' : ''}`}>
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
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="text-xs text-gray-400">
                                            From: {payment.sender.toString().slice(0, 4)}...
                                            {payment.sender.toString().slice(-4)}
                                        </div>
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