'use client'

import { useEffect, useState, useMemo } from 'react'
import { useWallet } from '@getpara/react-sdk';
import { PaymentHistory } from '@/components/payments/payment-history';
import { WithdrawFunds } from '@/components/payments/withdraw-funds';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { useAnchorProvider } from '@/components/para/para-provider';
import { useQuery } from '@tanstack/react-query';

const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

function getAssociatedTokenAddress(walletAddress: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [walletAddress.toBuffer(),
      new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
      mint.toBuffer()
    ],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
  )[0];
}

interface ManageFundsContentProps {
  merchantId: string;
}

export default function ManageFundsContent({ merchantId }: ManageFundsContentProps) {
  const [merchantBalance, setMerchantBalance] = useState<number>(0);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const provider = useAnchorProvider();

  const merchantPubkey = useMemo(() => {
    try {
      return new PublicKey(merchantId);
    } catch (e) {
      console.error('Error creating PublicKey:', e);
      return null;
    }
  }, [merchantId]);

  const program = useMemo(() => {
    if (!provider) return null;
    return getGotsolProgram(provider);
  }, [provider]);

  // Simple merchant data fetch to get owner
  const { data: merchantData } = useQuery({
    queryKey: ['merchant', merchantPubkey?.toString()],
    queryFn: async () => {
      if (!program || !merchantPubkey) return null;
      try {
        const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey);
        return merchantAccount;
      } catch (err) {
        console.error('Error fetching merchant data:', err);
        return null;
      }
    },
    enabled: !!program && !!merchantPubkey,
  });

  // Debug what's failing
  console.log('Debug:', {
    merchantId,
    merchantPubkey: !!merchantPubkey,
    program: !!program,
    merchantData: !!merchantData,
    owner: merchantData?.owner
  });

  if (!merchantPubkey || !program || !merchantData?.owner) {
    return (
      <div className="container mx-auto py-8 text-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="text-lg mt-4">Loading...</p>
        <div className="text-sm text-gray-500 mt-2">
          <p>Merchant ID: {merchantId}</p>
          <p>Merchant Pubkey: {merchantPubkey ? '✓' : '✗'}</p>
          <p>Program: {program ? '✓' : '✗'}</p>
          <p>Merchant Data: {merchantData ? '✓' : '✗'}</p>
          <p>Owner: {merchantData?.owner ? '✓' : '✗'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Withdraw Funds */}
        <div>
          <div className="card bg-base-300 shadow-xl">
            <div className="card-body p-4">
              <WithdrawFunds
                merchantPubkey={merchantPubkey}
                ownerPubkey={new PublicKey(merchantData.owner)}
                isDevnet={true}
              />
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div>
          <div className="card bg-base-300 shadow-xl">
            <div className="card-body p-4">
              <PaymentHistory
                program={program}
                merchantPubkey={merchantPubkey}
                isDevnet={true}
                onBalanceUpdate={setMerchantBalance}
                onPaymentReceived={() => setResetSignal(prev => prev + 1)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 