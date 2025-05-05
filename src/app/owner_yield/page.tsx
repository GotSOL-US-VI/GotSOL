'use client';

import { useEffect, useState } from 'react';
import { useWallet } from "@getpara/react-sdk";
import { BalanceDisplay } from "@/components/swap/balance-display";
import { useConnection } from '@/lib/connection-context';
import { ArrowsUpDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTokenBalance } from '@/hooks/useTokenBalance';

// Token addresses - using mainnet addresses directly since this is a mainnet-only component
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USD_STAR_MINT = 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6';

function SwapPageInner() {
  const { data: wallet } = useWallet();
  const { connection } = useConnection();
  const address = wallet?.address;
  const signer = (wallet as any)?.signer;
  const [isConnected, setIsConnected] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get USDC balance using our custom hook
  const { balance: usdcBalance, isLoading: isBalanceLoading } = useTokenBalance(USDC_MINT);

  useEffect(() => {
    const connected = !!address;
    setIsConnected(connected);
    console.log('Wallet connection status:', {
      address,
      connected,
      signer: !!signer
    });
  }, [address, signer]);

  const getQuote = async (inputAmount: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const amountInDecimals = Math.floor(inputAmount * 1_000_000);
      console.log('Getting quote:', {
        inputAmount,
        amountInDecimals,
        inputMint: USDC_MINT,
        outputMint: USD_STAR_MINT
      });

      const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MINT}&outputMint=${USD_STAR_MINT}&amount=${amountInDecimals}&slippageBps=50`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get quote');
      }

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
    if (!quote || !signer || !address) {
      console.error('Cannot execute swap:', { 
        hasQuote: !!quote, 
        hasSigner: !!signer, 
        hasAddress: !!address 
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Executing swap with address:', address);

      const transactions = await (
        await fetch('https://quote-api.jup.ag/v6/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: address,
            wrapAndUnwrapSol: false,
          })
        })
      ).json();

      console.log('Got swap transaction:', transactions);

      const { swapTransaction } = transactions;
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      
      console.log('Signing transaction...');
      const signedTx = await signer.signTransaction(swapTransactionBuf);
      
      console.log('Sending transaction...');
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      console.log('Transaction sent:', txid);
      
      await connection.confirmTransaction(txid);
      console.log('Transaction confirmed');

      setAmount('');
      setQuote(null);
      alert('Swap successful! Transaction ID: ' + txid);
    } catch (err) {
      console.error('Error executing swap:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (!wallet?.publicKey || !usdcBalance) return;
    const maxAmount = usdcBalance.toString();
    console.log('Setting max amount:', maxAmount);
    setAmount(maxAmount);
    getQuote(usdcBalance);
  };

  const handleHalfClick = () => {
    if (!wallet?.publicKey || !usdcBalance) return;
    const halfAmount = (usdcBalance / 2).toString();
    console.log('Setting half amount:', halfAmount);
    setAmount(halfAmount);
    getQuote(usdcBalance / 2);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex gap-8">
        {/* Balance Display Section - 30% width */}
        <div className="w-[30%]">
          <BalanceDisplay />
        </div>

        {/* Swap Section - 70% width */}
        <div className="w-[70%]">
          <div className="bg-base-100 rounded-3xl shadow-xl p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Convert Stablecoins</h2>
            </div>

            <div className="space-y-4">
              {/* Input Section */}
              <div className="bg-base-200 rounded-2xl p-4">
                <div className="text-sm text-base-content/70 mb-2">Convert</div>
                <div className="flex items-end justify-between">
                  <input
                    type="number"
                    className="text-4xl bg-transparent border-none focus:outline-none w-full"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (Number(e.target.value) > 0) {
                        getQuote(Number(e.target.value));
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 bg-base-300 rounded-xl px-3 py-2">
                    <img 
                      src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" 
                      alt="USDC" 
                      className="w-6 h-6"
                    />
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
                    <img 
                      src="https://raw.githubusercontent.com/perena11/perena-app/main/public/usd-star.png" 
                      alt="USD*" 
                      className="w-6 h-6"
                    />
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

              {!isConnected && (
                <button 
                  className="btn btn-primary w-full rounded-xl"
                >
                  Connect Wallet
                </button>
              )}

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


