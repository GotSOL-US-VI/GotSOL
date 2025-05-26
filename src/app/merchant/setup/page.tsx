'use client';

// import { useAnchorProvider } from '@/components/para/para-provider';
import * as anchor from '@coral-xyz/anchor';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import idl from '../../../utils/gotsol.json';
import { CreateMerchant } from '@/components/merchant/create-merchant';
import { PublicKey } from '@solana/web3.js';
import { AppHero } from '@/components/ui/ui-layout';
import { useConnection } from '@/lib/connection-context';
import { useWallet, useClient } from '@getpara/react-sdk';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";

export default function MerchantSetupPage() {
  // const provider = useAnchorProvider();
  const router = useRouter();
  const { connection } = useConnection();
  const { data: wallet } = useWallet();
  const para = useClient();
  
  // // Debug wallet data
  // console.log('Wallet data:', wallet);
  // console.log('Wallet public key:', wallet?.publicKey);
  // console.log('Para client:', para);
  
  // Initialize the program with Para signer
  const program = useMemo(() => {
    if (!wallet?.address || !connection || !para) {
      return null;
    }

    try {
      // Create Para Solana signer
      const solanaSigner = new ParaSolanaWeb3Signer(para, connection);

      // Create the provider directly with Para signer
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: new PublicKey(wallet.address),
          signTransaction: solanaSigner.signTransaction.bind(solanaSigner),
          // Note: Para signer doesn't support signAllTransactions, but that's ok
          // since we only need single transaction signing for our use case
          signAllTransactions: async (txs) => {
            return Promise.all(txs.map(tx => solanaSigner.signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Set the provider globally
      anchor.setProvider(provider);

      // Create the program with correct parameter order
      return new anchor.Program(
        idl as anchor.Idl,
        provider
      );
    } catch (error) {
      console.error('Error creating program:', error);
      return null;
    }
  }, [connection, wallet, para]);

  const handleSuccess = (merchantPubkey: PublicKey) => {
    // Redirect to the merchant dashboard
    router.push(`/merchant/dashboard/${merchantPubkey.toString()}`);
  };

  // Early return with debug info if no wallet
  if (!wallet?.address) {
    return (
      <div>
        <AppHero
          title="Create a Merchant"
          subtitle="Set up your merchant account to start accepting payments on Solana"
        />
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <div className="card-body">
              <div className="text-center py-8">
                <p className="text-white/80 mb-4">Please connect your wallet to continue</p>
                <p className="text-sm opacity-70">Debug info: {JSON.stringify({ wallet }, null, 2)}</p>
                <div className="w-16 h-16 mx-auto">
                  <div className="w-full h-full rounded-full bg-gradient-to-r from-mint to-lavender animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                <p className="text-white/80 mb-4">Initializing program...</p>
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