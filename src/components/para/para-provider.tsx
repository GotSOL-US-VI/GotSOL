"use client";

import {
  ParaProvider as ParaProviderV2,
  Environment,
  useWallet,
  ParaModal,
  AuthLayout,
  OAuthMethod
} from "@getpara/react-sdk";
import "@getpara/react-sdk/styles.css";
import { useState, createContext, useContext, useMemo } from "react";
import { useConnection } from '@/lib/connection-context';
import { useClient } from '@getpara/react-sdk';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { env } from '@/utils/env';

const ParaContext = createContext({
  openModal: () => { },
  closeModal: () => { },
  isOpen: false,
});

export const useParaModal = () => useContext(ParaContext);

export function ParaProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { connection } = useConnection();

  // Always use BETA environment since we're using a beta API key
  const environment = Environment.BETA;

  const paraApiKey = process.env.NEXT_PUBLIC_PARA_API_KEY;

  // Validate API key
  if (!paraApiKey) {
    console.error('Para API key is missing. Please check your environment variables.');
    console.log('Available env variables:', {
      NEXT_PUBLIC_PARA_API_KEY: process.env.NEXT_PUBLIC_PARA_API_KEY,
      environment,
      NODE_ENV: process.env.NODE_ENV
    });
    throw new Error('Para API key is required');
  }

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <ParaContext.Provider value={{ openModal, closeModal, isOpen }}>
      <ParaProviderV2
        paraClientConfig={{
          env: environment,
          apiKey: paraApiKey,
        }}
      >
        <ParaModal
          isOpen={isOpen}
          onClose={closeModal}
          disableEmailLogin={false}
          disablePhoneLogin={false}
          authLayout={[AuthLayout.AUTH_FULL]}
          oAuthMethods={[
            OAuthMethod.GOOGLE,
            OAuthMethod.FACEBOOK,
            OAuthMethod.APPLE,
            OAuthMethod.TWITTER,
            OAuthMethod.TELEGRAM,
            OAuthMethod.DISCORD,
          ]}
          theme={{
            foregroundColor: "#2D3648",
            backgroundColor: "#FFFFFF",
            accentColor: "#0066CC",
            darkForegroundColor: "#E8EBF2",
            darkBackgroundColor: "#1A1F2B",
            darkAccentColor: "#4D9FFF",
            mode: "light",
            borderRadius: "none",
            font: "Inter",
          }}
          appName="GotSOL"
          recoverySecretStepEnabled={false}
          twoFactorAuthEnabled={false}
        />
        {children}
      </ParaProviderV2>
    </ParaContext.Provider>
  );
}

export { useWallet };

// Create context for the Anchor provider
const AnchorProviderContext = createContext<anchor.AnchorProvider | null>(null);

export function ParaAnchorProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const { data: wallet } = useWallet();
  const para = useClient();

  const provider = useMemo(() => {
    if (!wallet?.address || !connection || !para) {
      // console.log('Missing dependencies for Anchor provider:', {
      //   hasWallet: !!wallet,
      //   hasAddress: !!wallet?.address,
      //   hasConnection: !!connection,
      //   hasPara: !!para
      // });
      return null;
    }

    try {
      // Create Para Solana signer
      const solanaSigner = new ParaSolanaWeb3Signer(para, connection);

      // Create the provider with Para signer
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: new PublicKey(wallet.address),
          signTransaction: solanaSigner.signTransaction.bind(solanaSigner),
          signAllTransactions: async (txs) => {
            return Promise.all(txs.map(tx => solanaSigner.signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Set the provider globally
      anchor.setProvider(provider);

      return provider;
    } catch (error) {
      console.error('Error creating Anchor provider:', error);
      return null;
    }
  }, [connection, wallet, para]);

  return (
    <AnchorProviderContext.Provider value={provider}>
      {children}
    </AnchorProviderContext.Provider>
  );
}

// Hook to use the Anchor provider
export function useAnchorProvider() {
  const context = useContext(AnchorProviderContext);
  if (context === undefined) {
    throw new Error('useAnchorProvider must be used within a ParaAnchorProvider');
  }
  return context;
}
