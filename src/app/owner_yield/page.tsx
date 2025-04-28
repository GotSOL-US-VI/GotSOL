'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { usePara } from "../../components/para/para-provider";
import { BalanceDisplay } from "@/components/swap/balance-display";
import '@jup-ag/terminal/css';

// Token addresses
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USD_STAR_MINT = 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6';

// Custom styles for Jupiter Terminal
const customStyles = `


  #jupiter-terminal button {
    color: #FFFFFF !important;
  }
  
  #jupiter-terminal [class*="button"] {
    color: #FFFFFF !important;
  }
  
  #jupiter-terminal [class*="Button"] {
    color: #FFFFFF !important;
  }
`;

export default function SwapPage() {
  const { address, signer } = usePara();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if wallet is connected
    setIsConnected(!!address);
  }, [address]);

  useEffect(() => {
    // Add custom styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = customStyles;
    document.head.appendChild(styleSheet);

    if (!isConnected || !signer) return;

    // Dynamically import and initialize Jupiter Terminal
    if (typeof window !== 'undefined') {
      import('@jup-ag/terminal').then((mod) => {
        const init = mod.init;
        
        // Create a custom wallet adapter for Para
        const paraWalletAdapter = {
          publicKey: address ? new PublicKey(address) : null,
          signTransaction: async (tx: Transaction | VersionedTransaction) => {
            if (!signer) throw new Error('Signer not available');
            return signer.signTransaction(tx);
          },
          signAllTransactions: async (txs: (Transaction | VersionedTransaction)[]) => {
            if (!signer) throw new Error('Signer not available');
            return Promise.all(txs.map(tx => signer.signTransaction(tx)));
          },
          // Add any other required methods
          connected: !!address,
          connecting: false,
          disconnect: async () => {
            // Implement disconnect if needed
            console.log('Disconnect requested');
          },
          connect: async () => {
            // Implement connect if needed
            console.log('Connect requested');
          },
          on: (event: string, callback: (args: any) => void) => {
            // Implement event listeners if needed
            console.log(`Event listener for ${event} requested`);
            return () => {}; // Return cleanup function
          },
        };

        init({
          displayMode: 'integrated',
          integratedTargetId: 'jupiter-terminal',
          endpoint: process.env.NEXT_PUBLIC_MAINNET_HELIUS_RPC_URL,
          formProps: {
            initialInputMint: USDC_MINT,
            initialOutputMint: USD_STAR_MINT,
            fixedInputMint: false,
            fixedOutputMint: true,
          },
          strictTokenList: false,
          defaultExplorer: 'Solana Explorer',
          containerStyles: {
            width: '100%',
            height: '600px',
          },
          containerClassName: 'text-white [&_button]:!text-white [&_[class*="button"]]:!text-white [&_[class*="Button"]]:!text-white',
          // @ts-ignore - The wallet property exists but TypeScript doesn't recognize it
          wallet: paraWalletAdapter,

          onSuccess: (result) => {
            console.log('Swap successful!', result);
          },
          onSwapError: (error) => {
            console.error('Swap failed:', error);
            if (error.error) {
              console.error('Error details:', error.error);
            }
            if (error.quoteResponseMeta) {
              console.error('Quote response:', error.quoteResponseMeta);
            }
            // Log the full error object for debugging
            console.error('Full error object:', JSON.stringify(error, null, 2));
          },
          onFormUpdate: (form) => {
            console.log('Form updated:', form);
            // Log the current form state for debugging
            console.log('Current form state:', {
              inputMint: form.inputMint,
              outputMint: form.outputMint,
              amount: form.amount,
            });
          },
          onScreenUpdate: (screen) => {
            console.log('Screen updated:', screen);
          }
        });
      }).catch(error => {
        console.error('Failed to load Jupiter Terminal:', error);
      });
    }

    return () => {
      // Cleanup if needed
      if (typeof window !== 'undefined' && window.Jupiter) {
        window.Jupiter.close();
      }
      // Remove custom styles
      document.head.removeChild(styleSheet);
    };
  }, [isConnected, address, signer]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Swap USDC ↔ USD*</h1>
      </div>
      <div className="flex gap-4">
        <div className="w-[20%]">
          <BalanceDisplay />
        </div>
        <div className="flex-1">
          {!isConnected ? (
            <div className="text-center p-8">
              <p className="text-lg mb-4">Please connect your wallet to start swapping</p>
            </div>
          ) : (
            <div id="jupiter-terminal" className="w-full" key="jupiter-terminal-container" />
          )}
        </div>
      </div>
    </div>
  );
}
