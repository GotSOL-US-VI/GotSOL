'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { usePara } from "../../components/para/para-provider";
import { BalanceDisplay } from "@/components/swap/balance-display";
import '@jup-ag/terminal/css';

// Helper function to get associated token address
async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0];
}

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
      import('@jup-ag/terminal').then(async (mod) => {
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
            return () => { }; // Return cleanup function
          },
        };

        // First, get your USDC ATA address
        const feeCollectorPubkey = new PublicKey("H1R73zDZsm8jcefc5WnQnAMAb6YKwLSm4soTqFwovpx4");
        const feeCollectorUsdcAta = await findAssociatedTokenAddress(
          feeCollectorPubkey,
          new PublicKey(USDC_MINT)
        );

        const feeCollectorUsdStarAta = await findAssociatedTokenAddress(
          feeCollectorPubkey,
          new PublicKey(USD_STAR_MINT)
        );

        console.log('fee collector usdc ata:', feeCollectorUsdcAta.toString());
        console.log('fee collector USD* ata:', feeCollectorUsdStarAta.toString());

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

          // @ts-ignore - Fee collection properties not in type definitions
          platformFeeBps: 1, // 0.01% fee (1 basis point)
          platformFeeAccounts: {
            feeBps: 1,
            feeAccounts: {
              [USDC_MINT]: feeCollectorUsdcAta.toString(),
              [USD_STAR_MINT]: feeCollectorUsdStarAta.toString()
            }
          },

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
      <div className="text-center">
        <h1 className="text-2xl font-bold text-warning">This feature is under construction!</h1>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Swap USDC to Perena&apos;s USD*</h1>
      </div>
      <div className="flex gap-4">
        <div className="w-[20%] flex flex-col gap-4">
          <BalanceDisplay />
          <p className="text-base">Perena&apos;s USD* is an interest-bearing stablecoin. <a
            href="https://solscan.io/token/BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mint underline hover:opacity-80 transition-opacity"
          >
            Token Explorer
          </a><br></br><br></br>It has no <em>Freeze Authority</em> nor <em>Permanent Delegate</em> and therefore can not be frozen by the issuer or removed from your account without your permission.</p>
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


