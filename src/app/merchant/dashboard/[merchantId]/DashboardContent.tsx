'use client';

import { useWallet } from '@getpara/react-sdk';
import { PaymentQR } from '@/components/payments/payment-qr';
import { PaymentHistory } from '@/components/payments/payment-history';
import { WithdrawFunds } from '@/components/payments/withdraw-funds';
import { useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { useAnchorProvider } from '@/components/para/para-provider';
import { useQuery } from '@tanstack/react-query';
import { SoundToggle } from '@/components/sound/sound-toggle';

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

export default function DashboardContent({ params }: { params: { merchantId: string } }) {
  const { data: wallet } = useWallet();
  const { connection } = useConnection();
  const provider = useAnchorProvider();
  const [merchantBalance, setMerchantBalance] = useState<number>(0);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const isDevnet = true; // TODO: Make this dynamic if needed

  const merchantPubkey = useMemo(() => {
    try {
      // Validate that merchantId is a valid base58 string
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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Access merchant data with fallback
  const merchantName = merchantData?.entityName || '';
  const owner = merchantData?.owner || null;

  // Use React Query to fetch balances
  const { data: balanceData } = useQuery({
    queryKey: ['balances', merchantPubkey?.toString(), owner?.toString()],
    queryFn: async () => {
      if (!merchantPubkey || !owner || !connection) return { merchantBalance: 0, ownerBalance: 0 };
      try {
        // Merchant USDC ATA
        const merchantStablecoinAta = getAssociatedTokenAddress(merchantPubkey, USDC_DEVNET_MINT);
        const merchantAtaInfo = await connection.getTokenAccountBalance(merchantStablecoinAta).catch(() => null);
        const mBalance = merchantAtaInfo ? Number(merchantAtaInfo.value.uiAmountString) : 0;
        
        // Owner USDC ATA
        const ownerStablecoinAta = getAssociatedTokenAddress(new PublicKey(owner), USDC_DEVNET_MINT);
        const ownerAtaInfo = await connection.getTokenAccountBalance(ownerStablecoinAta).catch(() => null);
        const oBalance = ownerAtaInfo ? Number(ownerAtaInfo.value.uiAmountString) : 0;
        
        return { merchantBalance: mBalance, ownerBalance: oBalance };
      } catch (err) {
        console.error('Error fetching balances:', err);
        return { merchantBalance: 0, ownerBalance: 0 };
      }
    },
    enabled: !!merchantPubkey && !!owner && !!connection,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Use balance data if available
  const ownerBalance = balanceData?.ownerBalance || 0;

  if (!wallet?.address || !merchantPubkey || !program) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-lg">Please connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <main className="container mx-auto py-2">
      {/* Hidden PaymentHistory component for payment detection */}
      <div className="hidden" aria-hidden="true">
        <PaymentHistory
          program={program}
          merchantPubkey={merchantPubkey}
          isDevnet={true}
          onPaymentReceived={() => setResetSignal(prev => prev + 1)}
        />
      </div>
      
      <div className="flex justify-center">
        <section className="w-full max-w-lg h-[660px]" aria-labelledby="pos-title">
          <div className="card bg-base-300 shadow-xl">
            <div className="card-body p-5">
              <header className="relative mb-3">
                <h1 id="pos-title" className="text-3xl font-bold text-center">Point of Sale</h1>
                <div className="absolute top-0 right-0" aria-label="Sound settings">
                  <SoundToggle className="" />
                </div>
              </header>
              {merchantName && (
                <h2 className="text-xl text-center text-gray-400 mt-1" aria-label={`Merchant: ${merchantName}`}>
                  {merchantName}
                </h2>
              )}
              <div className="flex-1 flex items-center justify-center" role="region" aria-label="Payment interface">
                <PaymentQR
                  merchantPubkey={merchantPubkey}
                  isDevnet={true}
                  resetSignal={resetSignal}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
} 