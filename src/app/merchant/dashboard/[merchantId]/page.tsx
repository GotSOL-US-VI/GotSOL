'use client';

import { useAnchorProvider } from '@/components/solana/solana-provider';
import { PaymentQR } from '@/components/payments/payment-qr';
import { PaymentHistory } from '@/components/payments/payment-history';
import { WithdrawFunds } from '@/components/payments/withdraw-funds';
import * as anchor from '@coral-xyz/anchor';
import { useMemo, useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import idl from '../../../../utils/kumbaya.json';
import type { MerchantAccount } from '@/components/payments/refund-button';

export default function MerchantDashboardPage({ params }: { params: { merchantId: string } }) {
  const provider = useAnchorProvider();
  const [merchantName, setMerchantName] = useState<string>('');

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

  useEffect(() => {
    const fetchMerchantName = async () => {
      if (program && merchantPubkey) {
        try {
          const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey) as MerchantAccount;
          setMerchantName(merchantAccount.entityName);
        } catch (err) {
          console.error('Error fetching merchant name:', err);
        }
      }
    };

    fetchMerchantName();
  }, [program, merchantPubkey]);

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
        {/* Left Column - Point of Sale */}
        <div className="h-[600px]">
          <div className="card bg-base-300 shadow-xl">
            <div className="card-body p-4">
              <h1 className="text-2xl font-bold text-center">Point of Sale</h1>
              {merchantName && (
                <h2 className="text-lg text-center text-gray-400 mt-1">{merchantName}</h2>
              )}
              <div className="flex-1 flex items-center justify-center">
                <PaymentQR 
                  program={program} 
                  merchantPubkey={merchantPubkey} 
                  isDevnet={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Withdraw & History */}
        <div className="space-y-6">
          {/* Withdraw Funds - Fixed Height */}
          <div className="h-[320px]">
            <div className="card bg-base-300 shadow-xl overflow-hidden">
              <div className="card-body p-4">
                <WithdrawFunds
                  program={program}
                  merchantPubkey={merchantPubkey}
                  isDevnet={true}
                />
              </div>
            </div>
          </div>

          {/* Payment History - Fixed Height */}
          <div className="h-[260px]">
            <div className="card bg-base-300 shadow-xl">
              <div className="card-body p-4">
                <PaymentHistory
                  program={program}
                  merchantPubkey={merchantPubkey}
                  isDevnet={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 