'use client';

import { useState, useEffect, useMemo } from 'react';
import { useConnection } from '@/lib/connection-context';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { toastUtils } from '@/utils/toast-utils';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet, useClient } from "@getpara/react-sdk";
import * as anchor from "@coral-xyz/anchor";
import { formatSolscanDevnetLink } from '@/utils/format-transaction-link';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { HOUSE, findAssociatedTokenAddress } from '@/utils/token-utils';
import { parseAnchorError, ErrorToastContent } from '@/utils/error-parser';
import { createClient } from '@/utils/supabaseClient';
import { fetchMerchantAccount } from '@/types/anchor';
import { TokenSelector, SupportedToken } from './token-selector';
import { useMultiTokenBalance, getTokenInfo } from '@/hooks/use-multi-token-balance';
import { getStablecoinMint } from '@/utils/stablecoin-config';
import { useTokenAccountListener } from '@/hooks/use-token-account-listener';

interface WithdrawFundsProps {
  merchantPubkey: PublicKey;
  ownerPubkey: PublicKey;
  isDevnet?: boolean;
  onSuccess?: () => void;
}

export function WithdrawFunds({ 
  merchantPubkey, 
  ownerPubkey,
  isDevnet = true,
  onSuccess
}: WithdrawFundsProps) {
  const { connection } = useConnection();
  const { data: wallet } = useWallet();
  const para = useClient();
  const queryClient = useQueryClient();
  const { isBalancesVisible, toggleBalanceVisibility } = useBalanceVisibility();
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDC');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  // 🎯 SINGLE SOURCE OF TRUTH: Token config with mint info
  const tokenConfig = useMemo(() => {
    const tokenInfo = getTokenInfo(selectedToken);
    
    if (selectedToken === 'SOL') {
      return {
        info: tokenInfo,
        mint: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL mint (for reference)
        isNative: true,
      };
    } else {
      return {
        info: tokenInfo,
        mint: getStablecoinMint(selectedToken, isDevnet),
        isNative: false,
      };
    }
  }, [selectedToken, isDevnet]);

  // Pre-calculate token addresses - this prevents listener spam
  const [tokenAddresses, setTokenAddresses] = useState<{
    merchantAta: PublicKey;
    ownerAta: PublicKey;
    houseAta: PublicKey;
  } | null>(null);

  // Extract values to separate variables for dependency array
  const merchantPubkeyString = merchantPubkey.toString();
  const ownerPubkeyString = ownerPubkey.toString(); 
  const tokenMintString = tokenConfig.mint.toString();

  useEffect(() => {
    const calculateAddresses = async () => {
      if (selectedToken === 'SOL') {
        setTokenAddresses({
          merchantAta: merchantPubkey,
          ownerAta: ownerPubkey,
          houseAta: HOUSE,
        });
      } else {
        const [merchantAta, ownerAta, houseAta] = await Promise.all([
          findAssociatedTokenAddress(merchantPubkey, tokenConfig.mint),
          findAssociatedTokenAddress(ownerPubkey, tokenConfig.mint),
          findAssociatedTokenAddress(HOUSE, tokenConfig.mint),
        ]);
        setTokenAddresses({ merchantAta, ownerAta, houseAta });
      }
    };
    
    calculateAddresses();
  }, [selectedToken, merchantPubkeyString, ownerPubkeyString, tokenMintString, merchantPubkey, ownerPubkey, tokenConfig.mint]);

  // Use the multi-token balance hook with our single source of truth  
  const { 
    data: merchantBalance = 0,
    usdBalance: merchantUsdBalance = 0,
    solPrice = 0,
    priceExpiresAt = 0,
    isNative = false,
    isLoading: isMerchantBalanceLoading, 
    refetch: refetchMerchantBalance 
  } = useMultiTokenBalance({
    address: merchantPubkey,
    token: selectedToken,
    isDevnet,
    staleTime: 5000 // Consider data stale after 5s
  });

  // Set up real-time WebSocket listener for balance changes - only when addresses are ready
  const { isListening } = useTokenAccountListener({
    tokenAccountAddress: tokenAddresses?.merchantAta || merchantPubkey, // Fallback to merchantPubkey if not ready
    isNativeAccount: selectedToken === 'SOL',
    enabled: !!tokenAddresses,
    onBalanceChange: (newBalance) => {
      console.log('🔊 Real-time balance update:', {
        token: selectedToken,
        isNative: selectedToken === 'SOL',
        newBalance,
        previousBalance: merchantBalance
      });
      // The query will be invalidated automatically, triggering a re-render
    }
  });

  // Debug: Log our single source of truth
  console.log('Token Configuration:', {
    selectedToken,
    tokenMint: tokenConfig.mint.toString(),
    merchantBalance,
    merchantUsdBalance,
    solPrice,
    isNative,
    tokenInfo: tokenConfig.info,
    isListening: isListening,
    merchantTokenAddress: tokenAddresses?.merchantAta?.toString(),
    tokenAddresses: tokenAddresses
  });

  // Function to trigger an immediate balance refresh using our token config
  const refreshBalances = async () => {
    try {
      // Invalidate queries using our single source of truth
      await queryClient.invalidateQueries({ 
        queryKey: ['token-balance', merchantPubkey.toString(), tokenConfig.mint.toString()]
      });
      
      // Also invalidate the general token balance queries
      await queryClient.invalidateQueries({
        queryKey: ['token-balance']
      });
      
      // Execute direct refetch
      await refetchMerchantBalance();
    } catch (err) {
      console.error('Error refreshing balances:', err);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet?.address || !connection || !para) {
      setError('Please connect your wallet');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (merchantBalance === 0 || parseFloat(withdrawAmount) > merchantBalance) {
      setError('Insufficient balance');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure token addresses are calculated
      if (!tokenAddresses) {
        setError('Token addresses not ready. Please try again.');
        return;
      }

      // Get all token accounts using our single source of truth
      const merchantTokenAta = tokenAddresses.merchantAta;
      const ownerTokenAta = tokenAddresses.ownerAta;
      const houseTokenAta = tokenAddresses.houseAta;

      // Create Para Solana signer
      const solanaSigner = new ParaSolanaWeb3Signer(para as any, connection);

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

      // Get the program to check merchant eligibility
      const program = getGotsolProgram(provider);
      let isFeeEligible = false;
      
      try {
        const merchantAccount = await fetchMerchantAccount(program, merchantPubkey);
        isFeeEligible = merchantAccount.feeEligible;
        console.log('Merchant fee eligible:', isFeeEligible);
      } catch (error) {
        console.warn('Failed to check merchant eligibility, using direct call:', error);
      }

      // Calculate amount using our token config
      const withdrawAmountU64 = Math.floor(parseFloat(withdrawAmount) * Math.pow(10, tokenConfig.info.decimals));
      
      // Debug logging with consistent token config
      console.log('Withdrawal details:', {
        selectedToken,
        tokenMint: tokenConfig.mint.toString(),
        merchantTokenAta: merchantTokenAta.toString(),
        ownerTokenAta: ownerTokenAta.toString(),
        houseTokenAta: houseTokenAta.toString(),
        merchantBalance,
        withdrawAmount,
        withdrawAmountU64,
        tokenDecimals: tokenConfig.info.decimals
      });
      
      let txid: string;

      // Smart routing: Use API for eligible merchants, direct call for others
      if (isFeeEligible) {
        console.log('Using API route for fee-eligible merchant');
        
        // Use the withdraw API route for fee-eligible merchants
        const network = isDevnet ? 'devnet' : 'mainnet';
        const apiUrl = `/api/withdraw/transaction?merchant=${merchantPubkey.toString()}&amount=${parseFloat(withdrawAmount)}&network=${network}&token=${selectedToken}`;
        
        // Get the transaction from API
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: wallet.address }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create withdraw transaction');
        }

        const { transaction: base64Transaction } = await response.json();
        
        // Deserialize and sign the transaction
        const transactionBuffer = Buffer.from(base64Transaction, 'base64');
        const transaction = anchor.web3.Transaction.from(transactionBuffer);
        
        // Sign with Para wallet
        const signedTransaction = await solanaSigner.signTransaction(transaction);
        
        // Send the signed transaction
        txid = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        
      } else {
        console.log('Using direct call for non-eligible merchant');

        // Validate merchant token account exists and has sufficient balance for SPL tokens
        if (!tokenConfig.isNative) {
          try {
            const merchantAccountInfo = await connection.getAccountInfo(merchantTokenAta);
            if (!merchantAccountInfo) {
              throw new Error(`Merchant ${selectedToken} account does not exist. Please ensure the merchant has received payments in ${selectedToken} first.`);
            }
            
            const merchantAccountBalance = await connection.getTokenAccountBalance(merchantTokenAta);
            const actualBalance = Number(merchantAccountBalance.value.uiAmount || 0);
            console.log(`Actual ${selectedToken} account balance:`, {
              account: merchantTokenAta.toString(),
              balance: actualBalance,
              requestedAmount: parseFloat(withdrawAmount),
              displayedBalance: merchantBalance,
              match: Math.abs(actualBalance - merchantBalance) < 0.000001 // Check if balances match within precision
            });
            
            if (actualBalance < parseFloat(withdrawAmount)) {
              throw new Error(`Insufficient ${selectedToken} balance. Available: ${actualBalance.toFixed(tokenConfig.info.decimals)}, Requested: ${withdrawAmount}`);
            }
          } catch (accountError) {
            console.error('Token account validation error:', accountError);
            throw accountError;
          }
        } else {
          // For SOL, validate native account balance
          try {
            const balance = await connection.getBalance(merchantTokenAta);
            const solBalance = balance / 1_000_000_000; // Convert lamports to SOL
            console.log(`Actual SOL account balance:`, {
              account: merchantTokenAta.toString(),
              balance: solBalance,
              requestedAmount: parseFloat(withdrawAmount),
              displayedBalance: merchantBalance,
              match: Math.abs(solBalance - merchantBalance) < 0.000001
            });
            
            if (solBalance < parseFloat(withdrawAmount)) {
              throw new Error(`Insufficient SOL balance. Available: ${solBalance.toFixed(9)}, Requested: ${withdrawAmount}`);
            }
          } catch (accountError) {
            console.error('SOL account validation error:', accountError);
            throw accountError;
          }
        }

        // Direct program call using our consistent token config
        if (selectedToken === 'SOL') {
          // Use withdraw_sol for SOL withdrawals
          const methodBuilder = program.methods
            .withdrawSol(new anchor.BN(withdrawAmountU64.toString()))
            .accountsPartial({
              owner: ownerPubkey,
              merchant: merchantPubkey,
              vault: tokenAddresses.merchantAta, // For SOL, vault is the merchant's native account
              house: HOUSE,
              systemProgram: anchor.web3.SystemProgram.programId,
            });

          txid = await methodBuilder.rpc();
        } else {
          // Use withdraw_spl for SPL token withdrawals
          const methodBuilder = program.methods
            .withdrawSpl(new anchor.BN(withdrawAmountU64.toString()))
            .accountsPartial({
              owner: ownerPubkey,
              merchant: merchantPubkey,
              stablecoinMint: tokenConfig.mint,
              merchantStablecoinAta: merchantTokenAta,
              ownerStablecoinAta: ownerTokenAta,
              house: HOUSE,
              houseStablecoinAta: houseTokenAta,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: anchor.web3.SystemProgram.programId,
            });

          txid = await methodBuilder.rpc();
        }
      }

      // Trigger immediate balance refresh
      await refreshBalances();
      
      // Set a short timeout and refresh again to ensure balances are updated
      setTimeout(async () => {
        await refreshBalances();
      }, 2000);

      toastUtils.success(
        <div>
          <p>Withdrawal successful!</p>
          <p className="text-xs mt-1">
            <a
              href={formatSolscanDevnetLink(txid)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          </p>
        </div>
      );

      setWithdrawAmount('');
      
      if (onSuccess) {
        onSuccess();
      }

      // Insert event data into Supabase
      const decimalAmount = parseFloat(withdrawAmount);

      await supabase.from('withdrawal_events').insert([
        {
          parawalletid: wallet.id,
          merchant_pda: merchantPubkey.toString(),
          owner_wallet: ownerPubkey.toString(),
          amount: withdrawAmountU64,
          decimal_amount: decimalAmount,
          txid,
          token: selectedToken,
          token_mint: tokenConfig.mint.toString(), // Store the exact mint used
        }
      ]);
    } catch (err) {
      console.error('Error withdrawing funds:', err);
      
      // Parse the error to get a more user-friendly message
      const parsedError = parseAnchorError(err);

      if (
        parsedError.message?.includes('BelowMinimumWithdrawal') ||
        parsedError.code === 'BELOW_MINIMUM_WITHDRAWAL'
      ) {
        setError(`${(0.000100).toFixed(6)} minimum`);
      } else if (
        parsedError.message?.toLowerCase().includes('insufficient') ||
        parsedError.code === 'INSUFFICIENT_FUNDS'
      ) {
        setError('Insufficient balance.');
      } else if (parsedError.code === 'NOT_MERCHANT_OWNER') {
        setError('Only the merchant owner can withdraw funds.');
      } else if (parsedError.code === 'INACTIVE_MERCHANT') {
        setError('This merchant account is currently inactive.');
      } else {
        setError('Failed to withdraw funds.');
        toastUtils.error(
          <ErrorToastContent 
            title="Failed to withdraw funds" 
            message={parsedError.message} 
          />
        );
      }
      
      // Still refresh balances in case of partial success
      refreshBalances();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (merchantBalance > 0) {
      setWithdrawAmount(merchantBalance.toFixed(tokenConfig.info.decimals));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers and a single decimal point
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    // Split on decimal point to check decimal places
    const [whole, decimal] = value.split('.');
    
    // If there's a decimal part, limit it to token's decimal places
    if (decimal && decimal.length > tokenConfig.info.decimals) {
      const truncatedDecimal = decimal.slice(0, tokenConfig.info.decimals);
      setWithdrawAmount(`${whole}.${truncatedDecimal}`);
      return;
    }

    // Ensure the value is not just a decimal point
    if (value === '.') {
      setWithdrawAmount('0.');
      return;
    }

    setWithdrawAmount(value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Only trigger withdrawal if form is valid and not loading
      const isFormValid = merchantPubkey && 
        ownerPubkey && 
        withdrawAmount && 
        parseFloat(withdrawAmount) > 0 && 
        merchantBalance > 0 && 
        parseFloat(withdrawAmount) <= merchantBalance && 
        !isLoading;
      
      if (isFormValid) {
        handleWithdraw();
      }
    }
  };

  const isLoadingBalances = isMerchantBalanceLoading;

  return (
    <div className="space-y-6 rounded-lg border border-base-content/10 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl">Withdraw to Owner</h2>
          <div className="opacity-60 cursor-help" title="1% platform fee on withdrawal amount. 99% to the Merchant&apos;s Owner. You must withdraw here first before withdrawing to a bank or card.">ⓘ</div>
        </div>
        <button
          onClick={() => toggleBalanceVisibility()}
          className="btn btn-ghost btn-sm btn-circle"
        >
          {isBalancesVisible ? (
            <EyeIcon className="h-5 w-5" />
          ) : (
            <EyeSlashIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="space-y-4">
        <TokenSelector 
          selectedToken={selectedToken}
          onTokenSelect={(token) => {
            setSelectedToken(token);
            setWithdrawAmount(''); // Clear amount when switching tokens
            setError(null); // Clear any errors
          }}
        />

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">Merchant&apos;s {selectedToken === 'SOL' ? 'SOL' : tokenConfig.info.name} balance</span>
            {isListening && (
              <div className="tooltip tooltip-top" data-tip="Real-time balance updates active">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          {isLoadingBalances ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <div className="text-right">
              <span>
                {isBalancesVisible 
                  ? (merchantBalance > 0 ? `${merchantBalance.toFixed(tokenConfig.info.decimals)} ${tokenConfig.info.symbol}` : `0.${'0'.repeat(tokenConfig.info.decimals)} ${tokenConfig.info.symbol}`)
                  : `••••••• ${tokenConfig.info.symbol}`
                }
              </span>
              {/* Show USD value for SOL */}
              {selectedToken === 'SOL' && isBalancesVisible && merchantUsdBalance > 0 && (
                <div className="text-xs text-gray-500">
                  ~${merchantUsdBalance.toFixed(2)} USD @ ${solPrice.toFixed(2)}/SOL
                </div>
              )}
              {selectedToken === 'SOL' && isBalancesVisible && solPrice > 0 && priceExpiresAt > 0 && (
                <div className="text-xs text-gray-400">
                  Price expires: {new Date(priceExpiresAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-80">
            Amount to Withdraw ({tokenConfig.info.symbol})
          </label>
          <input
            type="text"
            placeholder="0.00"
            className="input input-bordered w-full"
            value={withdrawAmount}
            onChange={handleAmountChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
        </div>
      </div>

      {error && (
        <div className="text-error text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleMaxClick}
          className="btn btn-outline"
          disabled={isLoading || merchantBalance <= 0}
        >
          MAX
        </button>
        <button
          onClick={handleWithdraw}
          className={`btn btn-primary ${(!merchantPubkey || 
            !ownerPubkey || 
            !withdrawAmount || 
            parseFloat(withdrawAmount) <= 0 || 
            merchantBalance <= 0 || 
            parseFloat(withdrawAmount) > merchantBalance || 
            isLoading) ? 'bg-[#111111] hover:bg-[#111111] hover:transform-none' : ''}`}
        >
          {isLoading ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}