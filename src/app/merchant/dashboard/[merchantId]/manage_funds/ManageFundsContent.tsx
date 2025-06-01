'use client';

import { useWallet } from '@getpara/react-sdk';
import { PaymentHistory } from '@/components/payments/payment-history';
import { WithdrawFunds } from '@/components/payments/withdraw-funds';
import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { useAnchorProvider } from '@/components/para/para-provider';
import { useQuery } from '@tanstack/react-query';
import { AppHero } from '@/components/ui/ui-layout';

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
  params: {
    merchantId: string;
  };
}

export default function ManageFundsContent({ params }: ManageFundsContentProps) {
  const { data: wallet } = useWallet();
  const { connection } = useConnection();
  const provider = useAnchorProvider();
  const isDevnet = true; // TODO: Make this dynamic if needed

  const merchantPubkey = useMemo(() => {
    try {
      if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(params.merchantId)) {
        console.error('Invalid merchant ID format:', params.merchantId);
        return null;
      }
      return new PublicKey(params.merchantId);
    } catch (e) {
      console.error('Error creating PublicKey:', e);
      return null;
    }
  }, [params.merchantId]);

  // Initialize program
  const program = useMemo(() => {
    if (!provider) return null;
    return getGotsolProgram(provider);
  }, [provider]);

  // Use React Query to fetch merchant data
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const owner = merchantData?.owner || null;

  if (!wallet?.address || !merchantPubkey || !program) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-lg">Please connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">Manage your Merchant&apos;s funds</h1>}
        subtitle={<p className="text-xl font-medium mt-4">On-chain withdrawals, off-ramp USD to bank, send on-chain, make revenue payments, and execute payroll</p>}
      />
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Withdraw Funds */}
          <div className="card bg-base-300 shadow-xl h-fit">
            <div className="card-body p-6">
              <h2 className="text-2xl font-semibold mb-4">Withdraw to Owner&apos;s Address</h2>
              {owner && merchantPubkey && (
                <WithdrawFunds
                  merchantPubkey={merchantPubkey}
                  ownerPubkey={new PublicKey(owner)}
                  isDevnet={true}
                />
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="card bg-base-300 shadow-xl">
            <div className="card-body p-6">
              <h2 className="text-2xl font-semibold mb-4">Payment History</h2>
              <PaymentHistory
                program={program}
                merchantPubkey={merchantPubkey}
                isDevnet={true}
                onBalanceUpdate={() => {}}
                onPaymentReceived={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 