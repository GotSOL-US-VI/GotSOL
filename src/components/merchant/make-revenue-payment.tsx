'use client';

import { useState, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import { useWallet } from "@getpara/react-sdk";
import { toastUtils } from '@/utils/toast-utils';
import { USDC_DEVNET_MINT, findAssociatedTokenAddress } from '@/utils/token-utils';

const GOV = new PublicKey('7WxjvbhBgAcWfTnL8yQy6iP1vF4n5fKPc7tL7fMYvSsc');

interface MakeRevenuePaymentButtonProps {
    program: Program<Idl>;
    merchantPubkey: PublicKey;
    merchantName: string;
    onSuccess?: () => void;
}

export function MakeRevenuePaymentButton({ program, merchantPubkey, merchantName, onSuccess }: MakeRevenuePaymentButtonProps) {
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

            // This is a placeholder for future implementation
            // Revenue payment feature is currently under development
            // When implemented, it will use the program, wallet, and merchant details
            
            toastUtils.success('Revenue payment feature is coming soon');
            
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Error making revenue payment:', err);
            setError('Failed to make revenue payment');
            toastUtils.error('Failed to make revenue payment');
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
                        disabled={true} // Disabled until feature is implemented
                    >
                        {isLoading ? 'Processing...' : 'Coming Soon'}
                    </button>
                </div>
                {error && <div className="text-error mt-2">{error}</div>}
            </div>
        </div>
    );
} 