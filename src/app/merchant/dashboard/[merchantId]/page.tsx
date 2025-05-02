'use client';

import { useWallet } from '@getpara/react-sdk';
import { PaymentQR } from '@/components/payments/payment-qr';
import { PaymentHistory } from '@/components/payments/payment-history';
import { WithdrawFunds } from '@/components/payments/withdraw-funds';
import { useMemo, useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { useConnection } from '@/lib/connection-context';
import { getKumbayaProgram } from '../../../../../anchor/src/kumbaya-exports';
import type { Kumbaya } from '../../../../../anchor/target/types/kumbaya';
import { useAnchorProvider, ParaAnchorProvider } from '@/components/para/para-provider';

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

function DashboardContent({ params }: { params: { merchantId: string } }) {
  const { data: wallet } = useWallet();
  const { connection } = useConnection();
  const provider = useAnchorProvider();
  const [merchantName, setMerchantName] = useState<string>('');
  const [merchantBalance, setMerchantBalance] = useState<number>(0);
  const [ownerBalance, setOwnerBalance] = useState<number>(0);
  const [owner, setOwner] = useState<PublicKey | null>(null);
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
    return getKumbayaProgram(provider);
  }, [provider]);

  useEffect(() => {
    const fetchMerchantData = async () => {
      if (!program || !merchantPubkey) return;
      
      try {
        const merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey);
        if (merchantAccount) {
          setMerchantName(merchantAccount.entityName);
          setOwner(merchantAccount.owner);
        }
      } catch (err) {
        console.error('Error fetching merchant data:', err);
      }
    };
    
    fetchMerchantData();
  }, [program, merchantPubkey]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!merchantPubkey || !owner || !connection) return;
      try {
        // Merchant USDC ATA
        const merchantUsdcAta = getAssociatedTokenAddress(merchantPubkey, USDC_DEVNET_MINT);
        const merchantAtaInfo = await connection.getTokenAccountBalance(merchantUsdcAta).catch(() => null);
        setMerchantBalance(merchantAtaInfo ? Number(merchantAtaInfo.value.uiAmountString) : 0);
        // Owner USDC ATA
        const ownerUsdcAta = getAssociatedTokenAddress(owner, USDC_DEVNET_MINT);
        const ownerAtaInfo = await connection.getTokenAccountBalance(ownerUsdcAta).catch(() => null);
        setOwnerBalance(ownerAtaInfo ? Number(ownerAtaInfo.value.uiAmountString) : 0);
      } catch (err) {
        console.error('Error fetching balances:', err);
      }
    };
    fetchBalances();
  }, [merchantPubkey, owner, connection]);

  if (!wallet?.address || !merchantPubkey || !program) {
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
                  merchantPubkey={merchantPubkey}
                  isDevnet={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Withdraw & History */}
        <div className="flex flex-col gap-6">
          {/* Withdraw Funds */}
          <div>
            <div className="card bg-base-300 shadow-xl">
              <div className="card-body p-4">
                {owner && merchantPubkey && (
                  <WithdrawFunds
                    merchantPubkey={merchantPubkey}
                    ownerPubkey={owner}
                    isDevnet={true}
                  />
                )}
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
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ params }: { params: { merchantId: string } }) {
  return (
    <ParaAnchorProvider>
      <DashboardContent params={params} />
    </ParaAnchorProvider>
  );
} 