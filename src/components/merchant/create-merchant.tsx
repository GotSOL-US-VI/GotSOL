'use client';

import { useState } from 'react';
import { useWallet, useClient } from "@getpara/react-sdk";
import { PublicKey } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { toastUtils } from '@/utils/toast-utils';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import type { Program } from '@coral-xyz/anchor';
import type { Gotsol } from '@/utils/gotsol-exports';

interface CreateMerchantProps {
    program: Program<Gotsol>;
    onSuccess?: () => void;
}

export function CreateMerchant({ program, onSuccess }: CreateMerchantProps) {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { data: wallet } = useWallet();
    const para = useClient();
    const publicKey = wallet?.address ? new PublicKey(wallet.address) : null;

    if (!publicKey) {
        return (
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title text-mint">Create New Merchant</h2>
                    <p className="text-white/60">Please connect your wallet to create a merchant account.</p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) {
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

            // Create the merchant using Para transaction signing
            const methodBuilder = program.methods
                .createMerchant(name)
                .accountsPartial({
                    owner: publicKey,
                    merchant: merchantPda,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                });

            // Get the transaction
            const transaction = await methodBuilder.transaction();

            // Get the latest blockhash
            const { blockhash } = await program.provider.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // Create Para Solana signer
            if (!para) {
                throw new Error("Para client not initialized");
            }
            const solanaSigner = new ParaSolanaWeb3Signer(para, program.provider.connection);

            // Sign and send the transaction
            const signedTransaction = await solanaSigner.signTransaction(transaction);
            const txSignature = await program.provider.connection.sendRawTransaction(
                signedTransaction.serialize()
            );

            // Wait for confirmation
            await program.provider.connection.confirmTransaction(txSignature, 'confirmed');

            console.log('Merchant created successfully:', txSignature);
            toastUtils.success(`Merchant "${name}" created successfully!`);

            // Reset form
            setName('');
            onSuccess?.();

        } catch (error: any) {
            console.error('Error creating merchant:', error);
            setError(error?.message || 'Failed to create merchant');
            toastUtils.error('Failed to create merchant', error?.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-mint">Create New Merchant</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Merchant Name</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Enter merchant name"
                            className="input input-bordered"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {error && (
                        <div className="alert alert-error">
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="card-actions justify-end">
                        <button
                            type="submit"
                            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                            disabled={isLoading || !name.trim()}
                        >
                            {isLoading ? 'Creating...' : 'Create Merchant'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
} 