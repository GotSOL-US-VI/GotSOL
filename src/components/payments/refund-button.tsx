import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Gotsol } from '@/types/anchor';
import { useConnection } from '@/lib/connection-context';
import { useQueryClient } from '@tanstack/react-query';
import { parseAnchorError, ErrorToastContent } from '@/utils/error-parser';
import { toastUtils } from '@/utils/toast-utils';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { createClient } from '@/utils/supabaseClient';
import { useWallet } from "@getpara/react-sdk";
import { usePara } from '@/components/para/para-provider';
import * as anchor from '@coral-xyz/anchor';
import { findAssociatedTokenAddress } from '@/utils/token-utils';
import { getStablecoinMint, getStablecoinDecimals } from '@/utils/stablecoin-config';
import { findVaultPda, findRefundRecordPda } from '@/utils/gotsol-exports';
import { fetchMerchantAccount } from '@/types/anchor';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";

interface RefundButtonProps {
    program: Program<Gotsol>;
    merchantPubkey: PublicKey;
    payment: {
        signature: string;
        amount: number;
        recipient: PublicKey;
        token?: string; // Add token field to determine if it's SOL or SPL
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
    const para = usePara();
    const supabase = createClient();

    const handleRefund = async () => {
        if (!publicKey || !wallet) {
            toastUtils.error('Please connect your wallet');
            return;
        }

        try {
            setIsLoading(true);

            // Get the correct mint based on payment token (default to USDC for backward compatibility)
            const paymentToken = payment.token || 'USDC';
            const tokenMint = getStablecoinMint(paymentToken, isDevnet);
            const tokenDecimals = getStablecoinDecimals(paymentToken);

            // Check if the merchant is eligible for reduced fees
            const merchantAccount = await fetchMerchantAccount(program, merchantPubkey);
            const isFeeEligible = merchantAccount.feeEligible;

            // Convert merchant name to bytes properly
            const merchantNameBytes = Buffer.from(merchantAccount.entityName);

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

            // Get merchant's token ATA using merchant PDA as authority
            const merchantTokenAta = await findAssociatedTokenAddress(merchantPda, tokenMint);

            // Get recipient's token ATA
            const recipientTokenAta = await findAssociatedTokenAddress(payment.recipient, tokenMint);

            // Convert amount to token decimals and to BN value
            const refundAmountU64 = Math.floor(payment.amount * Math.pow(10, tokenDecimals));
            const refundAmount = new anchor.BN(refundAmountU64.toString());

            // Take first 8 characters of the base58 signature string
            const signaturePrefix = payment.signature.slice(0, 8);

            // Get refund record PDA using the string's UTF-8 bytes (same as .as_bytes() in Rust)
            const [refundRecord, refundBump] = findRefundRecordPda(signaturePrefix);

            let tx: string;

            // Determine if this is a SOL or SPL token refund
            const isSOLRefund = payment.token === 'SOL' || !payment.token; // Default to SOL if token not specified

            // Smart routing: Use API for eligible merchants, direct call for others
            if (isFeeEligible) {
                console.log('Using API route for fee-eligible merchant refund');
                
                // Use the refund API route for fee-eligible merchants
                const network = isDevnet ? 'devnet' : 'mainnet';
                const apiUrl = `/api/refund/transaction?merchant=${merchantPubkey.toString()}&amount=${payment.amount}&recipient=${payment.recipient.toString()}&txSig=${signaturePrefix}&network=${network}&token=${paymentToken}`;
                
                // Get the transaction from API
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account: publicKey.toString() }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to create refund transaction');
                }

                const { transaction: base64Transaction } = await response.json();
                
                // Deserialize and sign the transaction
                const transactionBuffer = Buffer.from(base64Transaction, 'base64');
                const transaction = anchor.web3.Transaction.from(transactionBuffer);
                
                // Sign with Para wallet
                if (!para) throw new Error("Para client not initialized");
                
                // Create Para Solana signer (same as withdraw component)
                const solanaSigner = new ParaSolanaWeb3Signer(para as any, connection);
                
                // Sign the transaction
                const signedTransaction = await solanaSigner.signTransaction(transaction);
                
                // Send the signed transaction
                tx = await connection.sendRawTransaction(signedTransaction.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });
                
            } else {
                console.log('Using direct call for non-eligible merchant refund');

                if (isSOLRefund) {
                    // For SOL refunds, we need the vault PDA
                    const [vaultPda] = findVaultPda(merchantPda);

                    // Execute SOL refund
                    tx = await program.methods
                        .refundSol(signaturePrefix, refundAmount)
                        .accountsPartial({
                            owner: merchantAccount.owner,
                            merchant: merchantPda,
                            vault: vaultPda,
                            refundRecord,
                            recipient: payment.recipient,
                            systemProgram: anchor.web3.SystemProgram.programId
                        })
                        .rpc();
                } else {
                    // Execute SPL token refund (existing logic)
                    tx = await program.methods
                        .refundSpl(signaturePrefix, refundAmount)
                        .accountsPartial({
                            owner: merchantAccount.owner,
                            merchant: merchantPda,
                            stablecoinMint: tokenMint,
                            merchantStablecoinAta: merchantTokenAta,
                            recipientStablecoinAta: recipientTokenAta,
                            refundRecord,
                            recipient: payment.recipient,
                            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            systemProgram: anchor.web3.SystemProgram.programId
                        })
                        .rpc();
                }
            }

            // console.log('Refund successful:', tx);
            
            // Wait for confirmation
            await connection.confirmTransaction(tx, 'confirmed');
            
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
                            href={formatSolscanDevnetLink(tx)}
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
            const decimalAmount = refundAmountU64 / Math.pow(10, tokenDecimals);
            await supabase.from('refund_events').insert([
                {
                    parawalletid: paraWalletId,
                    merchant_pda: merchantPubkey.toString(),
                    owner_wallet: publicKey.toString(),
                    amount: refundAmountU64,
                    decimal_amount: decimalAmount,
                    original_tx_sig: payment.signature,
                    refund_tx_sig: tx,
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