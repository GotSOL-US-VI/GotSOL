'use client';

import { useAnchorProvider } from '@/components/solana/solana-provider';
import * as anchor from '@coral-xyz/anchor';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import idl from '../../../utils/kumbaya.json';
import { CreateMerchant } from '@/components/merchant/create-merchant';
import { PublicKey } from '@solana/web3.js';

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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        Set Up Your Merchant Account
      </h1>
      
      {program ? (
        <CreateMerchant program={program} onSuccess={handleSuccess} />
      ) : (
        <div className="text-center">
          <p>Please connect your wallet to continue</p>
        </div>
      )}
    </div>
  );
}