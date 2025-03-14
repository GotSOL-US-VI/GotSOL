'use client';

import * as anchor from "@coral-xyz/anchor";
import { useState } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";


interface CreateMerchantProps {
    program: Program<Idl>;
    onSuccess?: (merchantPubkey: PublicKey) => void;
}

export function CreateMerchant({ program, onSuccess }: CreateMerchantProps) {
    const { publicKey } = useWallet();
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Find the merchant PDA
            const [merchantPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('merchant'),
                    Buffer.from(name),
                    publicKey.toBuffer(),
                ],
                program.programId
            );

            // Get the USDC mint (using devnet for now)
            const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

            // main net USDC address
            const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

            // Create the merchant
            const tx = await program.methods
                .createMerchant(name)
                .accountsPartial({
                    owner: publicKey,
                    merchant: merchantPda,
                    usdcMint, // devnet USDC mint for now
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                })
                .rpc();

            console.log('Created merchant:', tx);
            onSuccess?.(merchantPda);
        } catch (err) {
            console.error('Failed to create merchant:', err);
            setError(err instanceof Error ? err.message : 'Failed to create merchant');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">Create Your Merchant Account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label">
                        <span className="label-text">Business Name</span>
                    </label>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your business name"
                        required
                        disabled={isLoading}
                    />
                </div>

                {error && (
                    <div className="alert alert-error">
                        <span>{error}</span>
                    </div>
                )}

                <button
                    type="submit"
                    className={`btn btn-primary w-full ${isLoading ? 'loading' : ''}`}
                    disabled={!publicKey || !name || isLoading}
                >
                    {isLoading ? 'Creating...' : 'Create Merchant'}
                </button>

                {!publicKey && (
                    <p className="text-sm text-center opacity-60">
                        Please connect your wallet to create a merchant account
                    </p>
                )}
            </form>
        </div>
    );
} 