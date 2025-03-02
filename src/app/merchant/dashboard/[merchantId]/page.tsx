'use client';

import { useAnchorProvider } from '@/components/solana/solana-provider';
import { PaymentQR } from '@/components/payments/payment-qr';
import { PaymentHistory } from '@/components/payments/payment-history';
import * as anchor from '@coral-xyz/anchor';
import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import idl from '../../../../utils/kumbaya.json';

export default function MerchantDashboardPage({ params }: { params: { merchantId: string } }) {
  const provider = useAnchorProvider();

  const program = useMemo(() => 
    provider ? new anchor.Program(idl as anchor.Idl, provider) : null
  , [provider]);

  const merchantPubkey = useMemo(() => {
    try {
      return new PublicKey(params.merchantId);
    } catch (e) {
      return null;
    }
  }, [params.merchantId]);

  if (!program || !merchantPubkey) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-lg">Please connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <div className="card bg-base-300 shadow-xl">
          <div className="card-body">
            <h1 className="text-3xl font-bold text-center mb-8">Point of Sale</h1>
            <PaymentQR 
              program={program} 
              merchantPubkey={merchantPubkey} 
              isDevnet={true} // TODO: Make this configurable based on environment
            />
          </div>
        </div>

        <div className="card bg-base-300 shadow-xl">
          <div className="card-body">
            <PaymentHistory
              program={program}
              merchantPubkey={merchantPubkey}
              isDevnet={true} // TODO: Make this configurable based on environment
            />
          </div>
        </div>
      </div>
    </div>
  );
} 