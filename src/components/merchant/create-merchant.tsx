'use client';

import * as anchor from "@coral-xyz/anchor";
import { useState } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@getpara/react-sdk";
import { toastUtils } from '@/utils/toast-utils';
import { parseAnchorError, ErrorToastContent } from '@/utils/error-parser';

interface CreateMerchantProps {
    program: Program<Idl>;
    onSuccess?: (merchantPubkey: PublicKey) => void;
}

export function CreateMerchant({ program, onSuccess }: CreateMerchantProps) {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const { data: wallet } = useWallet();
    
    // Debug log to see wallet data
    console.log('Para wallet data:', wallet);
    
    // Get the public key from Para wallet's address field
    const publicKey = wallet?.address ? new PublicKey(wallet.address) : null;
    
    console.log('Derived public key:', publicKey?.toString());

    if (!publicKey) {
        return (
            <div className="max-w-md mx-auto p-6">
                <p className="text-center text-lg">Please connect your wallet to create a merchant account</p>
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
                    Buffer.from(name),
                    publicKey.toBuffer(),
                ],
                program.programId
            );

            // Get the USDC mint (using devnet for now)
            const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

            // Create the merchant using standard transaction
            const tx = await program.methods
                .createMerchant(name)
                .accounts({
                    owner: publicKey,
                    merchant: merchantPda,
                    usdcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log('Created merchant:', merchantPda);
            toastUtils.success('Merchant account created successfully!');
            onSuccess?.(merchantPda);
        } catch (err) {
            console.error('Failed to create merchant:', err);
            
            // Parse the error to get a more user-friendly message
            const parsedError = parseAnchorError(err);
            setError(parsedError.message);

            // Display appropriate error toast based on the error code
            switch (parsedError.code) {
                case 'INVALID_MERCHANT_NAME':
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Invalid merchant name" 
                            message="Merchant name cannot be empty" 
                        />
                    );
                    break;
                case 'ACCOUNT_ALREADY_EXISTS':
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Merchant already exists" 
                            message="A merchant with this name already exists for your wallet" 
                        />
                    );
                    break;
                default:
                    // Generic error message with details if available
                    toastUtils.error(
                        <ErrorToastContent 
                            title="Failed to create merchant" 
                            message={parsedError.message} 
                        />
                    );
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">Create a Merchant Account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label">
                        <span className="label-text">Merchant Name</span>
                    </label>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your Merchant name"
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
            </form>
        </div>
    );
} 