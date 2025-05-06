'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useWallet, useClient } from "@getpara/react-sdk";
import { BalanceDisplay } from "@/components/swap/balance-display";
import { useConnection } from '@/lib/connection-context';
import { ArrowsUpDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { useParaModal } from '@/components/para/para-provider';
import { toast } from 'react-hot-toast';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Token addresses - using mainnet addresses directly since this is a mainnet-only component
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USD_STAR_MINT = 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6';

// Platform fee configuration
const PLATFORM_FEE_BPS = 0.1; // 0.001% in basis points

// Add fallback image URL for USD*
const USD_STAR_LOGO = 'https://ipfs.filebase.io/ipfs/QmPA375TeXunjaEQ5agLB7RQWgEpQaU59TD8RmUJxo17Ec';

// Helper function for finding token ATA
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

function SwapPageInner() {
  const { data: wallet } = useWallet();
  const { connection } = useConnection();
  const para = useClient();
  const { openModal } = useParaModal();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solanaSigner, setSolanaSigner] = useState<ParaSolanaWeb3Signer | null>(null);
  const [tokenList, setTokenList] = useState<any>(null);

  // Get wallet public key
  const publicKey = useMemo(() => {
    return wallet?.address ? new PublicKey(wallet.address) : null;
  }, [wallet?.address]);

  // Query for USDC balance
  const { data: usdcBalance, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['tokenBalance', USDC_MINT, publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey || !connection) return null;
      try {
        const ata = await findAssociatedTokenAddress(publicKey, new PublicKey(USDC_MINT));
        const balance = await connection.getTokenAccountBalance(ata);
        return balance;
      } catch (err) {
        console.error('Error fetching USDC balance:', err);
        return null;
      }
    },
    enabled: !!publicKey && !!connection,
    refetchInterval: 10000 // Refetch every 10 seconds
  });

  // Query for USD* balance
  const { data: usdStarBalance } = useQuery({
    queryKey: ['tokenBalance', USD_STAR_MINT, publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey || !connection) return null;
      try {
        const ata = await findAssociatedTokenAddress(publicKey, new PublicKey(USD_STAR_MINT));
        const balance = await connection.getTokenAccountBalance(ata);
        return balance;
      } catch (err) {
        console.error('Error fetching USD* balance:', err);
        return null;
      }
    },
    enabled: !!publicKey && !!connection,
    refetchInterval: 10000 // Refetch every 10 seconds
  });

  // Fetch Jupiter token list
  useEffect(() => {
    const fetchTokenList = async () => {
      try {
        const response = await fetch('https://token.jup.ag/strict');
        const data = await response.json();
        const tokens = data.reduce((acc: any, token: any) => {
          acc[token.address] = token;
          return acc;
        }, {});
        setTokenList(tokens);
      } catch (err) {
        console.error('Error fetching token list:', err);
      }
    };
    fetchTokenList();
  }, []);

  // Get token metadata
  const usdcToken = tokenList?.[USDC_MINT];
  const usdStarToken = tokenList?.[USD_STAR_MINT];

  // Setup signer function
  const setupSigner = useCallback(async () => {
    if (!publicKey || !para || !connection || !wallet?.id) {
      setSolanaSigner(null);
      return;
    }

    try {
      const signer = new ParaSolanaWeb3Signer(para, connection, wallet.id);
      setSolanaSigner(signer);
    } catch (err) {
      console.error('Error creating signer:', err);
      setSolanaSigner(null);
    }
  }, [publicKey, para, connection, wallet?.id]);

  // Handle connection status
  useEffect(() => {
    const connected = !!publicKey;
    setIsConnected(connected);

    if (connected) {
      setupSigner();
    } else {
      setSolanaSigner(null);
    }
  }, [publicKey, setupSigner]);

  // Log connection status only when it changes
  useEffect(() => {
    console.log('Wallet connection status:', {
      publicKey: publicKey?.toString(),
      walletId: wallet?.id,
      connected: isConnected,
      hasSigner: !!solanaSigner
    });
  }, [isConnected]); // Only depend on isConnected

  const getQuote = async (inputAmount: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const amountInDecimals = Math.floor(inputAmount * 1_000_000);
      console.log('Getting quote:', {
        inputAmount,
        amountInDecimals,
        inputMint: USDC_MINT,
        outputMint: USD_STAR_MINT,
        userPublicKey: publicKey?.toString(),
        platformFeeBps: PLATFORM_FEE_BPS
      });

      const response = await fetch('/api/jupiter/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputMint: USDC_MINT,
          outputMint: USD_STAR_MINT,
          amount: amountInDecimals,
          slippageBps: 50,
          platformFeeBps: PLATFORM_FEE_BPS
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get quote');
      }

      const data = await response.json();
      console.log('Quote received:', data);
      setQuote(data);
    } catch (err) {
      console.error('Error getting quote:', err);
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setIsLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!quote || !publicKey || !solanaSigner || !connection) {
      console.error('Cannot execute swap:', {
        hasQuote: !!quote,
        hasPublicKey: !!publicKey,
        hasSigner: !!solanaSigner,
        hasConnection: !!connection,
        walletId: wallet?.id
      });
      setError('Please connect your wallet and get a quote first');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First verify USDC balance
      if (!usdcBalance || Number(usdcBalance.value.uiAmount) < Number(amount)) {
        throw new Error(`Insufficient USDC balance. You have ${usdcBalance?.value.uiAmount || 0} USDC but are trying to swap ${amount} USDC`);
      }

      console.log('Executing swap with public key:', publicKey.toString());

      // Get your fee account for USDC (since we're taking fees in USDC)
      // const feeAccount = await findAssociatedTokenAddress(
      //   publicKey, // Your wallet address that will receive fees
      //   new PublicKey(USDC_MINT)
      // );

      const swapResponse = await fetch('/api/jupiter/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toString(),
          // feeAccount: feeAccount.toString()
        })
      });

      if (!swapResponse.ok) {
        const errorData = await swapResponse.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to get swap transaction');
      }

      const swapData = await swapResponse.json();
      console.log('Swap transaction data:', swapData);

      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      console.log('Signing transaction...');
      const signedTx = await solanaSigner.signTransaction(transaction);

      console.log('Sending transaction...');
      const txid = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      });
      console.log('Transaction sent:', txid);

      // Show pending toast
      toast.loading('Transaction pending...', { id: txid });

      try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const confirmation = await connection.confirmTransaction({
          signature: txid,
          blockhash,
          lastValidBlockHeight
        });

        if (confirmation.value.err) {
          throw new Error('Transaction failed on-chain');
        }

        // Clear loading toast and show success
        toast.dismiss(txid);
        toast.success('Swap successful! 🎉', {
          duration: 5000
        });

        // Open Solscan in new tab
        window.open(`https://solscan.io/tx/${txid}`, '_blank');

        setAmount('');
        setQuote(null);

        // Invalidate and refetch token balances
        queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });

      } catch (confirmError) {
        // Clear loading toast and show error
        toast.dismiss(txid);
        console.error('Transaction confirmation failed:', confirmError);
        throw new Error('Transaction failed to confirm. Please check Solscan for status.');
      }
    } catch (err) {
      console.error('Error executing swap:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to execute swap');
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (!publicKey || !usdcBalance) return;
    const maxAmount = usdcBalance.value.uiAmount?.toString() || '0';
    setAmount(maxAmount);
    if (Number(maxAmount) > 0) {
      getQuote(Number(maxAmount));
    }
  };

  const handleHalfClick = () => {
    if (!publicKey || !usdcBalance) return;
    const halfAmount = (Number(usdcBalance.value.uiAmount || 0) / 2).toString();
    setAmount(halfAmount);
    if (Number(halfAmount) > 0) {
      getQuote(Number(halfAmount));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex gap-8">
        {/* Balance Display Section - 30% width */}
        <div className="w-[30%]">
          <div className="flex flex-col space-y-6 p-6">
            <BalanceDisplay />
            <p className="text-base">Perena&apos;s USD* is an interest-bearing stablecoin. <a
              href="https://perena.notion.site/Product-Documentation-15fa37a29ca48060afd9cabb21b44d5c"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mint underline hover:opacity-80 transition-opacity"
            >
              Perena&apos;s Product Documentation
            </a> </p>
            <p className="text-base">It has no <em>Freeze Authority</em> nor <em>Permanent Delegate</em> and therefore can not be frozen by the issuer or removed from your account without your permission. <a
              href="https://solscan.io/token/BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mint underline hover:opacity-80 transition-opacity"
            >
              Token Explorer
            </a> </p>
          </div>
        </div>

        {/* Swap Section - 70% width */}
        <div className="w-[70%]">
          <div className="bg-base-100 rounded-3xl shadow-xl p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Swap USDC to Perena&apos;s USD*</h2>
            </div>

            <div className="space-y-4">
              {/* Input Section */}
              <div className="bg-base-200 rounded-2xl p-4">
                <div className="text-sm text-base-content/70 mb-2">Convert</div>
                <div className="flex items-end justify-between">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="text-4xl bg-transparent border-none focus:outline-none w-full"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only update if the value is empty or positive
                      if (value === '' || Number(value) >= 0) {
                        setAmount(value);
                        if (Number(value) > 0) {
                          getQuote(Number(value));
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent minus sign
                      if (e.key === '-' || e.key === 'e') {
                        e.preventDefault();
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 bg-base-300 rounded-xl px-3 py-2">
                    {usdcToken ? (
                      <img
                        src={usdcToken.logoURI}
                        alt={usdcToken.symbol}
                        className="w-6 h-6"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-base-200 rounded-full animate-pulse" />
                    )}
                    <span className="font-medium">USDC</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm text-base-content/70">
                    ${amount || '0.00'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleHalfClick}
                      disabled={isBalanceLoading || !usdcBalance}
                      className="text-xs bg-base-300 hover:bg-base-300/80 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Half
                    </button>
                    <button
                      onClick={handleMaxClick}
                      disabled={isBalanceLoading || !usdcBalance}
                      className="text-xs bg-base-300 hover:bg-base-300/80 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center -my-2">
                <div className="bg-primary rounded-xl p-2">
                  <ArrowsUpDownIcon className="w-5 h-5 text-primary-content" />
                </div>
              </div>

              {/* Output Section */}
              <div className="bg-base-200 rounded-2xl p-4">
                <div className="text-sm text-base-content/70 mb-2">To</div>
                <div className="flex items-end justify-between">
                  <div className="text-4xl">
                    {quote ? (Number(quote.outAmount) / 1_000_000).toFixed(6) : '0.000000'}
                  </div>
                  <div className="flex items-center gap-2 bg-base-300 rounded-xl px-3 py-2">
                    {usdStarToken?.logoURI ? (
                      <img
                        src={usdStarToken.logoURI}
                        alt="USD*"
                        className="w-6 h-6"
                      />
                    ) : (
                      <img
                        src={USD_STAR_LOGO}
                        alt="USD*"
                        className="w-6 h-6"
                        onError={(e) => {
                          // If the image fails to load, show a fallback div
                          const target = e.target as HTMLImageElement;
                          const div = document.createElement('div');
                          div.className = 'w-6 h-6 bg-base-200 rounded-full flex items-center justify-center text-xs font-medium';
                          div.textContent = 'USD*';
                          target.parentNode?.replaceChild(div, target);
                        }}
                      />
                    )}
                    <span className="font-medium">USD*</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm text-base-content/70">
                    ${quote ? (Number(quote.outAmount) / 1_000_000).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>

              {/* Market Price */}
              <div className="text-sm text-base-content/70 flex justify-between items-center">
                <span>1 USDC = {quote ? (Number(quote.outAmount) / Number(quote.inAmount)).toFixed(6) : '0.000000'} USD*</span>
                <button className="hover:text-base-content transition-colors">
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="text-error text-sm">
                  {error}
                </div>
              )}

              {!isConnected ? (
                <button
                  className="btn btn-primary w-full rounded-xl"
                  onClick={openModal}
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  className="btn btn-primary w-full rounded-xl"
                  onClick={executeSwap}
                  disabled={!quote || isLoading}
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Swap'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the SwapPageInner component directly
export default function SwapPage() {
  return <SwapPageInner />;
}


