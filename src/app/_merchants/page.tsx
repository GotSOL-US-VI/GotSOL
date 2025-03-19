'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAnchorProvider } from '@/components/solana/solana-provider';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '@/utils/kumbaya.json';

interface MerchantAccount {
    owner: PublicKey;
    entity_name: string;
    total_withdrawn: anchor.BN;
    total_refunded: anchor.BN;
    merchant_bump: number;
}

interface MerchantData {
    publicKey: PublicKey;
    account: MerchantAccount;
}

export default function MerchantsPage() {
    const provider = useAnchorProvider();
    const [merchants, setMerchants] = useState<MerchantData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const program = useMemo(() => 
        provider ? new anchor.Program(idl as anchor.Idl, provider) : null
    , [provider]);

    const fetchMerchants = useCallback(async () => {
        if (!program) throw new Error('Program not initialized');

        try {
            const merchants = await (program.account as any).merchant.all();
            return merchants.filter((merchant: MerchantData) => {
                try {
                    // Verify the account data is valid
                    return merchant.account.owner && merchant.account.entity_name;
                } catch (error) {
                    console.warn('Skipping invalid merchant account:', merchant.publicKey.toString());
                    return false;
                }
            });
        } catch (error) {
            console.error('Error fetching merchants:', error);
            throw error;
        }
    }, [program]);

    useEffect(() => {
        if (!program) {
            setLoading(false);
            return;
        }

        fetchMerchants()
            .then(merchants => {
                setMerchants(merchants);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [program, fetchMerchants]);

    if (!provider) {
        return (
            <div className="container mx-auto py-8 text-center">
                <p className="text-lg">Please connect your wallet to continue</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto py-8 text-center">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto py-8">
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">Merchants</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {merchants.map((merchant) => (
                    <div key={merchant.publicKey.toString()} className="card bg-base-300 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title">{merchant.account.entity_name}</h2>
                            <p className="text-sm text-gray-500">
                                {merchant.publicKey.toString().slice(0, 4)}...{merchant.publicKey.toString().slice(-4)}
                            </p>
                            <div className="card-actions justify-end mt-4">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => window.location.href = `/merchant/dashboard/${merchant.publicKey.toString()}`}
                                >
                                    View Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 