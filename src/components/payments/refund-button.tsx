import { useState } from 'react';
import { useConnection } from '@/lib/connection-context';
import * as anchor from "@coral-xyz/anchor";
import { Program, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { toastUtils } from '@/utils/toast-utils';
import { env } from '@/utils/env';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { useWallet } from "@getpara/react-sdk";
import type { Gotsol } from '@/utils/gotsol-exports';
import { useQueryClient } from '@tanstack/react-query';
import { findAssociatedTokenAddress, USDC_MINT, USDC_DEVNET_MINT } from '@/utils/token-utils';
import { parseAnchorError, ErrorToastContent } from '@/utils/error-parser';
import { useClient } from "@getpara/react-sdk";
import { createClient } from '@/utils/supabaseClient';

export interface MerchantAccount {
    owner: PublicKey;
    entityName: string;
    totalWithdrawn: BN;
    totalRefunded: BN;
    merchantBump: number;
}

interface RefundButtonProps {
    program: Program<Gotsol>;
    merchantPubkey: PublicKey;
    payment: {
        signature: string;
        amount: number;
        recipient: PublicKey;
    };
    onSuccess?: () => void;
    isDevnet?: boolean;
}

export function RefundButton({ program, merchantPubkey, payment, onSuccess, isDevnet = true }: RefundButtonProps) {
    const { connection } = useConnection();
    const { data: wallet } = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();
    const publicKey = wallet?.address ? new PublicKey(wallet.address) : null;
    const para = useClient();
    const supabase = createClient();

    const handleRefund = async () => {
        if (!publicKey || !wallet) {
            toastUtils.error('Please connect your wallet');
            return;
        }

        try {
            setIsLoading(true);

            const usdcMint = isDevnet ? USDC_DEVNET_MINT : USDC_MINT;

            // Fetch merchant account data first
            // console.log('Fetching merchant account from:', merchantPubkey.toString());
            const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey) as MerchantAccount;

            if (!merchantAccount) {
                throw new Error('Merchant account not found');
            }

            // Log merchant details for debugging
            // console.log('Fetched Merchant Details:', {
            //     entityName: merchantAccount.entityName,
            //     owner: merchantAccount.owner.toString(),
            //     totalWithdrawn: merchantAccount.totalWithdrawn.toString(),
            //     totalRefunded: merchantAccount.totalRefunded.toString(),
            //     bump: merchantAccount.merchantBump
            // });

            // Convert merchant name to bytes properly
            const merchantNameBytes = Buffer.from(merchantAccount.entityName);

            // Debug merchant name bytes
            // console.log('Merchant Name Debug:', {
            //     raw: merchantAccount.entityName,
            //     bytes: Array.from(merchantNameBytes),
            //     length: merchantNameBytes.length,
            //     utf8: merchantNameBytes.toString('utf8'),
            //     hex: merchantNameBytes.toString('hex')
            // });

            // Debug merchant PDA seeds lengths
            // console.log('Merchant PDA Seeds Lengths:', {
            //     seed1: {
            //         name: 'merchant',
            //         length: Buffer.from('merchant', 'utf8').length,
            //         value: Buffer.from('merchant', 'utf8')
            //     },
            //     seed2: {
            //         name: 'merchantName',
            //         length: merchantNameBytes.length,
            //         value: merchantNameBytes
            //     },
            //     seed3: {
            //         name: 'ownerPubkey',
            //         length: merchantAccount.owner.toBuffer().length,
            //         value: merchantAccount.owner.toBuffer()
            //     }
            // });

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
            const merchantUsdcAta = await findAssociatedTokenAddress(merchantPda, usdcMint);

            // Get recipient's USDC ATA
            const recipientUsdcAta = await findAssociatedTokenAddress(payment.recipient, usdcMint);

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
            // console.log('PDA Derivation Debug:', {
            //     seeds: {
            //         seed1: {
            //             type: 'refund',
            //             bytes: Array.from(Buffer.from('refund')),
            //         },
            //         seed2: {
            //             type: 'signature_prefix',
            //             string: signaturePrefix,
            //             bytes: Array.from(Buffer.from(signaturePrefix)),
            //         }
            //     },
            //     result: {
            //         address: refundRecord.toString(),
            //         bump: refundBump,
            //     }
            // });

            // Comprehensive debug logging
            // console.log('=== COMPLETE REFUND TRANSACTION DEBUG ===');

            // // 1. Program and Instruction Details
            // console.log('Program Details:', {
            //     programId: program.programId.toString(),
            //     instruction: 'refund',
            //     instructionArgs: {
            //         originalTxSig: signaturePrefix,  // Pass the 8-char string directly
            //         amount: refundAmount.toString(),
            //         amountU64: refundAmountU64,
            //     }
            // });

            // // 2. All Account Keys and PDAs
            // console.log('Account Details:', {
            //     owner: {
            //         pubkey: publicKey?.toString(),
            //         isSigner: true,
            //         isWritable: true
            //     },
            //     merchant: {
            //         pubkey: merchantPda.toString(),
            //         derivation: {
            //             seeds: [
            //                 { name: 'merchant', value: Array.from(Buffer.from('merchant')) },
            //                 { name: 'entityName', value: Array.from(merchantNameBytes) },
            //                 { name: 'owner', value: Array.from(merchantAccount.owner.toBuffer()) }
            //             ],
            //             bump: merchantAccount.merchantBump
            //         },
            //         data: {
            //             owner: merchantAccount.owner.toString(),
            //             entityName: merchantAccount.entityName,
            //             totalWithdrawn: merchantAccount.totalWithdrawn.toString(),
            //             totalRefunded: merchantAccount.totalRefunded.toString()
            //         }
            //     },
            //     merchantUsdcAta: {
            //         pubkey: merchantUsdcAta.toString(),
            //         mint: usdcMint.toString(),
            //         authority: merchantPda.toString()
            //     },
            //     recipientUsdcAta: {
            //         pubkey: recipientUsdcAta.toString(),
            //         mint: usdcMint.toString(),
            //         authority: payment.recipient.toString()
            //     },
            //     refundRecord: {
            //         pubkey: refundRecord.toString(),
            //         derivation: {
            //             seeds: [
            //                 { name: 'refund', value: Array.from(Buffer.from('refund')) },
            //                 {
            //                     name: 'signaturePrefix',
            //                     raw: signaturePrefix,
            //                     asString: signaturePrefix
            //                 }
            //             ],
            //             bump: refundBump
            //         }
            //     },
            //     recipient: payment.recipient.toString(),
            //     usdcMint: usdcMint.toString()
            // });

            // // 3. Expected Account Order from IDL
            // console.log('Expected Account Order from IDL:', [
            //     'owner (signer)',
            //     'merchant (pda)',
            //     'merchantUsdcAta',
            //     'recipientUsdcAta',
            //     'refundRecord (pda)',
            //     'usdcMint',
            //     'recipient',
            //     'tokenProgram',
            //     'systemProgram'
            // ]);

            // // 4. Original Transaction Details
            // console.log('Original Transaction:', {
            //     signature: payment.signature,
            //     truncatedSignature: signaturePrefix,
            //     amount: payment.amount,
            //     recipient: payment.recipient.toString()
            // });

            // Send the transaction
            const txid = await program.methods
                .refund(signaturePrefix, refundAmount)
                .accountsPartial({
                    owner: publicKey,
                    merchant: merchantPda,
                    merchantUsdcAta: merchantUsdcAta,
                    recipientUsdcAta: recipientUsdcAta,
                    refundRecord: refundRecord,
                    usdcMint: usdcMint,
                    recipient: payment.recipient,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            // console.log('Refund successful:', txid);
            
            // Wait for confirmation
            await connection.confirmTransaction(txid, 'confirmed');
            
            // Invalidate relevant queries for both merchant and recipient balances
            await Promise.all([
                // Invalidate merchant balance
                queryClient.invalidateQueries({ 
                    queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet],
                    refetchType: 'active' // Force immediate refetch
                }),
                // Invalidate recipient balance in case they're viewing it
                queryClient.invalidateQueries({ 
                    queryKey: ['usdc-balance', payment.recipient.toString(), isDevnet],
                    refetchType: 'active' // Force immediate refetch
                }),
                // Also invalidate token balance queries
                queryClient.invalidateQueries({
                    queryKey: ['token-balance'],
                    refetchType: 'active'
                }),
                // Invalidate payment history
                queryClient.invalidateQueries({
                    queryKey: ['payments', merchantPubkey.toString(), isDevnet],
                    refetchType: 'active'
                })
            ]);
            
            // Additional fetch for immediate UI update
            const refreshBalances = async () => {
                try {
                    // Wait a moment for blockchain to process the transaction
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Force immediate refetch of balances
                    await queryClient.refetchQueries({ 
                        queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet],
                    });
                    
                    // Also refetch payments data
                    await queryClient.refetchQueries({ 
                        queryKey: ['payments', merchantPubkey.toString(), isDevnet],
                    });
                } catch (err) {
                    console.error('Error refreshing data after refund:', err);
                }
            };
            
            // Start refreshing balances immediately
            refreshBalances();
            
            toastUtils.success(
                <div>
                    <p>Refund processed successfully!</p>
                    <p className="text-xs mt-1">
                        <a
                            href={formatSolscanDevnetLink(txid)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            View transaction
                        </a>
                    </p>
                </div>
            );
            
            // Call onSuccess callback if provided
            if (onSuccess) {
                onSuccess();
            }

            // Store event in Supabase
            if (!para) throw new Error("Para client not initialized");
            const wallets = para.getWallets();
            const paraWalletId = Object.values(wallets)[0].id;
            await supabase.from('refund_events').insert([
                {
                    paraWalletId,
                    merchant_pda: merchantPubkey.toString(),
                    owner_wallet: publicKey.toString(),
                    amount: refundAmountU64,
                    original_tx_sig: payment.signature,
                    refund_tx_sig: txid,
                    recipient_wallet: payment.recipient.toString(),
                }
            ]);

        } catch (error) {
            console.error('Refund error:', error);

            // Parse the error to get a more user-friendly message
            const parsedError = parseAnchorError(error);

            // Display appropriate error message based on the error code
            switch (parsedError.code) {
                case 'INSUFFICIENT_FUNDS':
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Insufficient funds" 
                            message="The merchant account doesn't have enough USDC to process this refund." 
                        />
                    );
                    break;
                case 'EXCEEDS_REFUND_LIMIT':
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Refund exceeds limit" 
                            message="This refund exceeds the Merchant&apos;s configured refund limit." 
                        />
                    );
                    break;
                case 'REFUND_ALREADY_PROCESSED':
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Refund already processed" 
                            message="This payment has already been refunded. This program prevents double refunds." 
                        />
                    );
                    break;
                case 'NOT_MERCHANT_OWNER':
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Unauthorized" 
                            message="Only the Merchant&apos;s owner can process refunds." 
                        />
                    );
                    break;
                default:
                    // Generic error message with details if available
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Unable to process refund" 
                            message={parsedError.message} 
                        />
                    );
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