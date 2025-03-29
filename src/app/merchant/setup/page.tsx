'use client';

import { useAnchorProvider } from '@/components/solana/solana-provider';
import * as anchor from '@coral-xyz/anchor';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import idl from '../../../utils/kumbaya.json';
import { CreateMerchant } from '@/components/merchant/create-merchant';
import { PublicKey } from '@solana/web3.js';
import { AppHero } from '@/components/ui/ui-layout';

export default function MerchantSetupPage() {
  const provider = useAnchorProvider();
  const router = useRouter();

  const program = useMemo(() => 
    provider ? new anchor.Program(idl as anchor.Idl, provider) : null
  , [provider]);

  const handleSuccess = (merchantPubkey: PublicKey) => {
    // Redirect to the merchant dashboard
    router.push(`/merchant/dashboard/${merchantPubkey.toString()}`);
  };

  return (
    <div>
      <AppHero
        title="Create a Merchant"
        subtitle="Set up your merchant account to start accepting payments on Solana"
      />
      
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-body">
            {program ? (
              <CreateMerchant program={program} onSuccess={handleSuccess} />
            ) : (
              <div className="text-center py-8">
                <p className="text-white/80 mb-4">Please connect your wallet to continue</p>
                <div className="w-16 h-16 mx-auto">
                  <div className="w-full h-full rounded-full bg-gradient-to-r from-mint to-lavender animate-pulse"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}