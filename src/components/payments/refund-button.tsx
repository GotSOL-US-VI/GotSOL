import { useState } from 'react';
import { useConnection } from '@/lib/connection-context';
import * as anchor from "@coral-xyz/anchor";
import { Program, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { usePara } from '../para/para-provider';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import toast from 'react-hot-toast';
import bs58 from 'bs58';
import { env } from '@/utils/env';

export interface MerchantAccount {
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
const USDC_MINT_MAINNET = new PublicKey(env.usdcMint);

export function RefundButton({ program, merchantPubkey, payment, onSuccess, isDevnet = true }: RefundButtonProps) {
    const { connection } = useConnection();
    const { address, signer } = usePara();
    const [isLoading, setIsLoading] = useState(false);
    const publicKey = address ? new PublicKey(address) : null;

    const handleRefund = async () => {
        if (!publicKey) {
            toast.error('Please connect your wallet');
            return;
        }

        try {
            setIsLoading(true);

            const usdcMint = isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;

            // Fetch merchant account data first
            console.log('Fetching merchant account from:', merchantPubkey.toString());
            const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey) as MerchantAccount;

            if (!merchantAccount) {
                throw new Error('Merchant account not found');
            }

            // Log merchant details for debugging
            console.log('Fetched Merchant Details:', {
                entityName: merchantAccount.entityName,
                owner: merchantAccount.owner.toString(),
                totalWithdrawn: merchantAccount.totalWithdrawn.toString(),
                totalRefunded: merchantAccount.totalRefunded.toString(),
                bump: merchantAccount.merchantBump
            });

            // Convert merchant name to bytes properly
            const merchantNameBytes = Buffer.from(merchantAccount.entityName);

            // Debug merchant name bytes
            console.log('Merchant Name Debug:', {
                raw: merchantAccount.entityName,
                bytes: Array.from(merchantNameBytes),
                length: merchantNameBytes.length,
                utf8: merchantNameBytes.toString('utf8'),
                hex: merchantNameBytes.toString('hex')
            });

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
            const merchantUsdcAta = await getAssociatedTokenAddressSync(
                usdcMint,
                merchantPda,
                true
            );

            // Get recipient's USDC ATA
            const recipientUsdcAta = await getAssociatedTokenAddressSync(
                usdcMint,
                payment.recipient,
                true
            );

            // Convert amount to USDC decimals (6 decimals) and to BN value
            const refundAmountU64 = Math.floor(payment.amount * 1_000_000);
            const refundAmount = new anchor.BN(refundAmountU64.toString());

            // Take first 8 characters of the base58 signature string
            const signaturePrefix = payment.signature.slice(0, 8);

            // Get refund record PDA using the string's UTF-8 bytes (same as .as_bytes() in Rust)
            const [refundRecord, refundBump] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('refund'),
                    Buffer.from(signaturePrefix)  // Convert string to UTF-8 bytes
                ],
                program.programId
            );

            // Debug PDA derivation
            console.log('PDA Derivation Debug:', {
                seeds: {
                    seed1: {
                        type: 'refund',
                        bytes: Array.from(Buffer.from('refund')),
                    },
                    seed2: {
                        type: 'signature_prefix',
                        string: signaturePrefix,
                        bytes: Array.from(Buffer.from(signaturePrefix)),
                    }
                },
                result: {
                    address: refundRecord.toString(),
                    bump: refundBump,
                }
            });

            // Comprehensive debug logging
            console.log('=== COMPLETE REFUND TRANSACTION DEBUG ===');

            // 1. Program and Instruction Details
            console.log('Program Details:', {
                programId: program.programId.toString(),
                instruction: 'refund',
                instructionArgs: {
                    originalTxSig: signaturePrefix,  // Pass the 8-char string directly
                    amount: refundAmount.toString(),
                    amountU64: refundAmountU64,
                }
            });

            // 2. All Account Keys and PDAs
            console.log('Account Details:', {
                owner: {
                    pubkey: publicKey?.toString(),
                    isSigner: true,
                    isWritable: true
                },
                merchant: {
                    pubkey: merchantPda.toString(),
                    derivation: {
                        seeds: [
                            { name: 'merchant', value: Array.from(Buffer.from('merchant')) },
                            { name: 'entityName', value: Array.from(merchantNameBytes) },
                            { name: 'owner', value: Array.from(merchantAccount.owner.toBuffer()) }
                        ],
                        bump: merchantAccount.merchantBump
                    },
                    data: {
                        owner: merchantAccount.owner.toString(),
                        entityName: merchantAccount.entityName,
                        totalWithdrawn: merchantAccount.totalWithdrawn.toString(),
                        totalRefunded: merchantAccount.totalRefunded.toString()
                    }
                },
                merchantUsdcAta: {
                    pubkey: merchantUsdcAta.toString(),
                    mint: usdcMint.toString(),
                    authority: merchantPda.toString()
                },
                recipientUsdcAta: {
                    pubkey: recipientUsdcAta.toString(),
                    mint: usdcMint.toString(),
                    authority: payment.recipient.toString()
                },
                refundRecord: {
                    pubkey: refundRecord.toString(),
                    derivation: {
                        seeds: [
                            { name: 'refund', value: Array.from(Buffer.from('refund')) },
                            {
                                name: 'signaturePrefix',
                                raw: signaturePrefix,
                                asString: signaturePrefix
                            }
                        ],
                        bump: refundBump
                    }
                },
                recipient: payment.recipient.toString(),
                usdcMint: usdcMint.toString()
            });

            // 3. Expected Account Order from IDL
            console.log('Expected Account Order from IDL:', [
                'owner (signer)',
                'merchant (pda)',
                'merchantUsdcAta',
                'recipientUsdcAta',
                'refundRecord (pda)',
                'usdcMint',
                'recipient',
                'tokenProgram',
                'systemProgram'
            ]);

            // 4. Original Transaction Details
            console.log('Original Transaction:', {
                signature: payment.signature,
                truncatedSignature: signaturePrefix,
                amount: payment.amount,
                recipient: payment.recipient.toString()
            });

            // Build the transaction
            const tx = program.methods
                .refund(signaturePrefix, refundAmount)  // Pass the string directly
                .accountsPartial({
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
                });

            // Check if recipient's ATA exists
            const recipientAtaInfo = await program.provider.connection.getAccountInfo(recipientUsdcAta);

            // If recipient's ATA doesn't exist, create it first
            if (!recipientAtaInfo) {
                const provider = program.provider as anchor.AnchorProvider;
                const createAtaTx = new anchor.web3.Transaction().add(
                    createAssociatedTokenAccountIdempotentInstruction(
                        publicKey,
                        payment.recipient,
                        usdcMint,
                        recipientUsdcAta
                    )
                );
                await provider.sendAndConfirm(createAtaTx);
            }

            // Simulate first
            try {
                const simulation = await tx.simulate();
                console.log('Simulation success:', simulation);
            } catch (simError: any) {
                // Still log the full error details for debugging
                console.error('Simulation error details:', {
                    error: simError,
                    logs: simError.logs,
                    message: simError.message
                });

                // Get logs from simulation response
                const simulationLogs = simError?.simulationResponse?.logs || [];

                // Check if any log contains "already in use"
                if (simulationLogs.some((log: string) => log.includes('already in use'))) {
                    throw new Error('REFUND_ALREADY_PROCESSED');
                }

                // For other simulation errors, throw a generic error
                throw new Error('SIMULATION_FAILED');
            }

            // If simulation succeeds, send the transaction
            const txid = await tx.rpc();

            console.log('Refund successful:', txid);
            toast.success('Refund processed successfully!');
            onSuccess?.();

        } catch (error) {
            console.error('Refund error:', error);

            if (error instanceof Error && error.message === 'REFUND_ALREADY_PROCESSED') {
                toast.error('This refund has already been processed');
            } else {
                toast.error('Unable to process refund');
            }
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