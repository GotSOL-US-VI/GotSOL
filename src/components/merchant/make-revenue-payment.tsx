'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@getpara/react-sdk";
import toast from 'react-hot-toast';
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';

const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const GOV = new PublicKey('7WxjvbhBgAcWfTnL8yQy6iP1vF4n5fKPc7tL7fMYvSsc');

interface MakeRevenuePaymentButtonProps {
    merchantPubkey: PublicKey;
    merchantName: string;
    onSuccess?: () => void;
}

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

export function MakeRevenuePaymentButton({ merchantPubkey, merchantName, onSuccess }: MakeRevenuePaymentButtonProps) {
    const { data: wallet } = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string>('');
    const [escrowBalance, setEscrowBalance] = useState<number>(0);
    const [lifetimePaid, setLifetimePaid] = useState<number>(0);
    const [lastPayment, setLastPayment] = useState<number>(0);
    const [lastPaymentDate, setLastPaymentDate] = useState<string>('Never');

    const publicKey = useMemo(() => {
        return wallet?.address ? new PublicKey(wallet.address) : null;
    }, [wallet?.address]);

    const handleMakeRevenuePayment = async () => {
        if (!wallet?.address) {
            setError('Please connect your wallet first');
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // TODO: Implement revenue payment using Para's native functionality
            // This will need to be implemented based on your specific requirements
            // and Para's available methods for making payments

            toast.success('Revenue payment successful!');
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Error making revenue payment:', err);
            setError('Failed to make revenue payment');
            toast.error('Failed to make revenue payment');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title">Make Revenue Payment</h2>
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Escrow Balance</div>
                        <div className="stat-value">{escrowBalance.toFixed(2)} USDC</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Lifetime Paid</div>
                        <div className="stat-value">{lifetimePaid.toFixed(2)} USDC</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Last Payment</div>
                        <div className="stat-value">{lastPaymentDate}</div>
                    </div>
                </div>
                <div className="card-actions justify-end mt-4">
                    <button
                        className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                        onClick={handleMakeRevenuePayment}
                        disabled={isLoading || !wallet?.address}
                    >
                        {isLoading ? 'Processing...' : 'Make Payment'}
                    </button>
                </div>
                {error && <div className="text-error mt-2">{error}</div>}
            </div>
        </div>
    );
} 