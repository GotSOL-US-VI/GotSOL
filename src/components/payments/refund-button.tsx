import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import * as anchor from "@coral-xyz/anchor";
import { Program, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import toast from 'react-hot-toast';
import bs58 from 'bs58';

interface MerchantAccount {
    owner: PublicKey;
    entityName: string;
    totalWithdrawn: BN;
    totalRefunded: BN;
    merchantBump: number;
}

interface RefundButtonProps {
    program: Program<Idl>;
    merchantPubkey: PublicKey;
    payment: {
        signature: string;
        amount: number;
        recipient: PublicKey;
    };
    onSuccess?: () => void;
    isDevnet?: boolean;
}

const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export function RefundButton({ program, merchantPubkey, payment, onSuccess, isDevnet = true }: RefundButtonProps) {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [isLoading, setIsLoading] = useState(false);

    const handleRefund = async () => {
        if (!publicKey) {
            toast.error('Please connect your wallet');
            return;
        }

        try {
            setIsLoading(true);
            
            const usdcMint = isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;

            // Fetch merchant account data first
            const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey) as MerchantAccount;
            if (!merchantAccount) {
                throw new Error('Merchant account not found');
            }

            // Convert merchant name to bytes properly
            const merchantNameBytes = Buffer.from(merchantAccount.entityName, 'utf8');

            // Debug merchant PDA seeds lengths
            console.log('Merchant PDA Seeds Lengths:', {
                seed1: {
                    name: 'merchant',
                    length: Buffer.from('merchant', 'utf8').length,
                    value: Buffer.from('merchant', 'utf8')
                },
                seed2: {
                    name: 'merchantName',
                    length: merchantNameBytes.length,
                    value: merchantNameBytes
                },
                seed3: {
                    name: 'ownerPubkey',
                    length: merchantAccount.owner.toBuffer().length,
                    value: merchantAccount.owner.toBuffer()
                }
            });

            // Derive merchant PDA using merchant owner's public key
            const [merchantPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('merchant', 'utf8'),
                    merchantNameBytes,
                    merchantAccount.owner.toBuffer()  // Use merchant owner's pubkey, not current signer
                ],
                program.programId
            );

            // Verify the derived PDA matches the provided merchant pubkey
            if (!merchantPda.equals(merchantPubkey)) {
                console.error('Merchant PDA mismatch:', {
                    derived: merchantPda.toString(),
                    provided: merchantPubkey.toString(),
                    entityName: merchantAccount.entityName,
                    owner: merchantAccount.owner.toString()
                });
                throw new Error('Derived merchant PDA does not match provided merchant pubkey');
            }

            // Get merchant's USDC ATA using merchant PDA as authority
            const merchantUsdcAta = await getAssociatedTokenAddress(
                usdcMint,
                merchantPda,
                true
            );

            // Get recipient's USDC ATA
            const recipientUsdcAta = await getAssociatedTokenAddress(
                usdcMint,
                payment.recipient,
                true
            );

            // Convert amount to USDC decimals (6 decimals) and to BN value
            const refundAmountU64 = Math.floor(payment.amount * 1_000_000);
            const refundAmount = new anchor.BN(refundAmountU64.toString());

            // Decode the base58 signature and take first 16 bytes
            const decodedSig = (bs58.decode as (str: string) => Buffer)(payment.signature);
            const signatureBuffer = decodedSig.subarray(0, 16);
            
            // Debug refund record PDA seeds lengths
            console.log('Refund Record PDA Seeds Lengths:', {
                seed1: {
                    name: 'refund',
                    length: Buffer.from('refund', 'utf8').length,
                    value: Array.from(Buffer.from('refund', 'utf8')),
                    hex: Buffer.from('refund', 'utf8').toString('hex')
                },
                seed2: {
                    name: 'signature_truncated',
                    length: signatureBuffer.length,
                    value: Array.from(signatureBuffer),
                    hex: signatureBuffer.toString('hex'),
                    signatureOriginal: payment.signature,
                    signatureBase58Full: decodedSig.toString('hex'),
                    signatureBase58Truncated: signatureBuffer.toString('hex')
                }
            });

            // Get refund record PDA using the truncated signature
            const [refundRecord, refundBump] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('refund', 'utf8'),
                    signatureBuffer
                ],
                program.programId
            );

            // Log the final PDA addresses and data with detailed seed information
            console.log('PDA Derivation Details:', {
                merchant: {
                    seeds: {
                        prefix: {
                            value: Array.from(Buffer.from('merchant', 'utf8')),
                            hex: Buffer.from('merchant', 'utf8').toString('hex')
                        },
                        name: {
                            value: Array.from(merchantNameBytes),
                            hex: merchantNameBytes.toString('hex'),
                            string: merchantAccount.entityName
                        },
                        owner: {
                            value: Array.from(merchantAccount.owner.toBuffer()),
                            hex: merchantAccount.owner.toBuffer().toString('hex'),
                            string: merchantAccount.owner.toString()
                        },
                        bump: merchantAccount.merchantBump
                    },
                    result: merchantPda.toString()
                },
                refund: {
                    seeds: {
                        prefix: {
                            value: Array.from(Buffer.from('refund', 'utf8')),
                            hex: Buffer.from('refund', 'utf8').toString('hex')
                        },
                        signature: {
                            original: payment.signature,
                            truncated: {
                                value: Array.from(signatureBuffer),
                                hex: signatureBuffer.toString('hex'),
                                length: signatureBuffer.length
                            },
                            base58Decoded: (() => {
                                const decodedSig = (bs58.decode as (str: string) => Buffer)(payment.signature);
                                return {
                                    value: Array.from(decodedSig),
                                    hex: decodedSig.toString('hex'),
                                    length: decodedSig.length
                                };
                            })()
                        },
                        bump: refundBump
                    },
                    result: refundRecord.toString()
                },
                programId: program.programId.toString()
            });

            // Debug logging
            console.log('Transaction preparation:', {
                instruction: {
                    originalSignature: payment.signature,
                    signatureBytes: Array.from(signatureBuffer),
                    amount: refundAmount.toString(),
                    amountU64: refundAmountU64,
                },
                accounts: {
                    owner: {
                        address: publicKey.toString(),
                        isSigner: true,
                        isWritable: true
                    },
                    merchant: {
                        address: merchantPda.toString(),
                        owner: merchantAccount.owner.toString(),
                        entityName: merchantAccount.entityName,
                        bump: merchantAccount.merchantBump
                    },
                    merchantUsdcAta: merchantUsdcAta.toString(),
                    recipientUsdcAta: recipientUsdcAta.toString(),
                    refundRecord: refundRecord.toString(),
                    recipient: payment.recipient.toString(),
                    usdcMint: usdcMint.toString(),
                },
                originalPayment: {
                    signature: payment.signature,
                    amount: payment.amount,
                }
            });

            // Debug simulation
            try {
                // Build the transaction first
                const tx = await program.methods
                    .refund(payment.signature, refundAmount)
                    .accounts({
                        owner: publicKey,
                        merchant: merchantPda,
                        merchantUsdcAta: merchantUsdcAta,
                        recipientUsdcAta: recipientUsdcAta,
                        refundRecord: refundRecord,
                        usdcMint: usdcMint,
                        recipient: payment.recipient,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .preInstructions([
                        // Add a check for recipient's USDC ATA existence
                        createAssociatedTokenAccountIdempotentInstruction(
                            publicKey,
                            payment.recipient,
                            usdcMint,
                            recipientUsdcAta
                        )
                    ])
                    .transaction();

                // Get the latest blockhash
                const latestBlockhash = await program.provider.connection.getLatestBlockhash();
                tx.recentBlockhash = latestBlockhash.blockhash;
                tx.feePayer = publicKey;

                // Simulate the transaction
                const simulation = await program.provider.connection.simulateTransaction(tx);
                
                if (simulation.value.err) {
                    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
                }

                console.log('Simulation success:', {
                    logs: simulation.value.logs,
                    unitsConsumed: simulation.value.unitsConsumed,
                });

                // If simulation succeeds, send the transaction
                const txid = await program.methods
                    .refund(payment.signature, refundAmount)
                    .accounts({
                        owner: publicKey,
                        merchant: merchantPda,
                        merchantUsdcAta: merchantUsdcAta,
                        recipientUsdcAta: recipientUsdcAta,
                        refundRecord: refundRecord,
                        usdcMint: usdcMint,
                        recipient: payment.recipient,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .preInstructions([
                        createAssociatedTokenAccountIdempotentInstruction(
                            publicKey,
                            payment.recipient,
                            usdcMint,
                            recipientUsdcAta
                        )
                    ])
                    .rpc();

                console.log('Refund successful:', txid);
                toast.success('Refund processed successfully!');
                onSuccess?.();

            } catch (simError) {
                console.error('Detailed simulation error:', {
                    error: simError,
                    seeds: {
                        refund: Array.from(Buffer.from('refund', 'utf8')),
                        truncatedSig: Array.from(signatureBuffer)
                    },
                    accounts: {
                        owner: publicKey.toString(),
                        merchant: merchantPda.toString(),
                        merchantUsdcAta: merchantUsdcAta.toString(),
                        recipientUsdcAta: recipientUsdcAta.toString(),
                        refundRecord: refundRecord.toString(),
                        recipient: payment.recipient.toString(),
                        tokenProgram: TOKEN_PROGRAM_ID.toString(),
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
                        systemProgram: anchor.web3.SystemProgram.programId.toString(),
                    },
                    params: {
                        signature: payment.signature,
                        amount: refundAmount.toString()
                    }
                });

                // Log any simulation logs if available
                if (simError instanceof Error && 'logs' in simError) {
                    console.error('Simulation logs:', (simError as any).logs);
                }

                throw simError;
            }
        } catch (error) {
            console.error('Refund error:', error);
            // Log detailed error information
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                });
                
                // Check for Anchor program error
                if ('error' in error && typeof error.error === 'object') {
                    console.error('Anchor error:', error.error);
                }
                
                // Check for logs in the error
                if ('logs' in error && Array.isArray(error.logs)) {
                    console.error('Transaction logs:', error.logs);
                }
            }
            
            toast.error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            className="btn btn-xs btn-info"
            onClick={handleRefund}
            disabled={isLoading}
        >
            {isLoading ? (
                <span className="loading loading-spinner loading-xs"></span>
            ) : (
                'Refund'
            )}
        </button>
    );
} 