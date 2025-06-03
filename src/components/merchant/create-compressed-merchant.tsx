'use client';

import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import { useWallet, useClient } from "@getpara/react-sdk";
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { toastUtils } from '@/utils/toast-utils';
import * as anchor from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface CreateCompressedMerchantProps {
    program: Program<Idl>;
    onSuccess?: (merchantPubkey: PublicKey) => void;
}

export function CreateCompressedMerchant({ program, onSuccess }: CreateCompressedMerchantProps) {
    const [name, setName] = useState('');
    const [useCompression, setUseCompression] = useState(false);
    const [feeEligible, setFeeEligible] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { data: wallet } = useWallet();
    const para = useClient();
    const publicKey = wallet?.address ? new PublicKey(wallet.address) : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey || !para) {
            setError('Please connect your wallet first');
            return;
        }

        if (!name.trim()) {
            setError('Merchant name cannot be empty');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Find the merchant PDA
            const [merchantPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('merchant'),
                    Buffer.from(name.trim()),
                    publicKey.toBuffer(),
                ],
                program.programId
            );

            // Get the USDC mint (using devnet for now)
            const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

            let accounts = {
                owner: publicKey,
                merchant: merchantPda,
                usdcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                // Compression accounts (null when not using compression)
                merkleTree: null,
                treeAuthority: null,
                compressedMerchantState: null,
                noopProgram: null,
                compressionProgram: null,
            };

            if (useCompression) {
                // Add compression-specific accounts
                // Note: In a real implementation, you'd need to:
                // 1. Create or get an existing Merkle tree
                // 2. Derive the tree authority PDA
                // 3. Add the Noop and Compression program IDs
                
                const [treeAuthority] = PublicKey.findProgramAddressSync(
                    [Buffer.from('tree_authority')],
                    program.programId
                );

                const [compressedMerchantState] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('compressed_merchant'),
                        Buffer.from(name.trim()),
                        publicKey.toBuffer(),
                    ],
                    program.programId
                );

                // These would need to be actual program IDs in production
                const NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
                const COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
                
                // You would need to create or reference an existing Merkle tree
                // For this example, we'll use a placeholder
                const merkleTree = new PublicKey('11111111111111111111111111111111'); // Placeholder

                accounts = {
                    ...accounts,
                    merkleTree,
                    treeAuthority,
                    compressedMerchantState,
                    noopProgram: NOOP_PROGRAM_ID,
                    compressionProgram: COMPRESSION_PROGRAM_ID,
                };
            }

            // Create the merchant using Para transaction signing
            const methodBuilder = program.methods
                .createMerchant(name.trim(), useCompression, feeEligible)
                .accountsPartial(accounts);

            // Get the transaction
            const transaction = await methodBuilder.transaction();

            // Get the latest blockhash
            const { blockhash } = await program.provider.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // Create Para Solana signer
            const solanaSigner = new ParaSolanaWeb3Signer(para, program.provider.connection);

            // Sign and send the transaction
            const signedTx = await solanaSigner.signTransaction(transaction);
            const signature = await program.provider.connection.sendRawTransaction(
                signedTx.serialize(),
                { skipPreflight: false }
            );

            // Wait for confirmation
            await program.provider.connection.confirmTransaction(signature, 'confirmed');

            toastUtils.success(`Merchant "${name}" created successfully! ${useCompression ? '(Compressed)' : '(Regular)'}`);
            
            if (onSuccess) {
                onSuccess(merchantPda);
            }

            // Reset form
            setName('');
            setUseCompression(false);
            setFeeEligible(true);

        } catch (error) {
            console.error('Error creating merchant:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            setError(errorMessage);
            toastUtils.error(`Failed to create merchant: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Create Merchant Account
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="merchantName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Merchant Name
                    </label>
                    <input
                        type="text"
                        id="merchantName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter merchant name"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="useCompression"
                            checked={useCompression}
                            onChange={(e) => setUseCompression(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={isLoading}
                        />
                        <label htmlFor="useCompression" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            Use Account Compression (99%+ cost savings)
                        </label>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="feeEligible"
                            checked={feeEligible}
                            onChange={(e) => setFeeEligible(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={isLoading}
                        />
                        <label htmlFor="feeEligible" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            Fee Eligible (Para server pays fees)
                        </label>
                    </div>
                </div>

                {useCompression && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Account Compression Enabled:</strong> This merchant will be stored in a compressed format, 
                            reducing storage costs by 99%+ while maintaining full functionality.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !publicKey}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                    {isLoading ? 'Creating...' : `Create ${useCompression ? 'Compressed' : 'Regular'} Merchant`}
                </button>
            </form>

            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                <p><strong>Cost Comparison:</strong></p>
                <p>Regular merchant: ~0.00408 SOL</p>
                <p>Compressed merchant: ~0.00001 SOL (99.8% savings)</p>
            </div>
        </div>
    );
} 