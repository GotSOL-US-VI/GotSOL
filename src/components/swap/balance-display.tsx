'use client';

import { useEffect, useState } from 'react';
import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { usePara } from '../para/para-provider';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} from '@solana/spl-token';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

// Token addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USD_STAR_MINT = new PublicKey('BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6');

// Use mainnet connection
const mainnetConnection = new Connection(clusterApiUrl('mainnet-beta'));

export function BalanceDisplay() {
  const { address } = usePara();
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [usdStarBalance, setUsdStarBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBalancesVisible, setIsBalancesVisible] = useState(true);

  const publicKey = address ? new PublicKey(address) : null;

  const fetchBalances = async () => {
    if (!publicKey) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get USDC ATA
      const usdcAta = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Get USD* ATA
      const usdStarAta = await getAssociatedTokenAddress(
        USD_STAR_MINT,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Get USDC balance
      try {
        // Check if the account exists first
        const accountInfo = await mainnetConnection.getAccountInfo(usdcAta);
        if (accountInfo) {
          const usdcBalanceResponse = await mainnetConnection.getTokenAccountBalance(usdcAta);
          const usdcBalance = usdcBalanceResponse ? Number(usdcBalanceResponse.value.uiAmount) : 0;
          setUsdcBalance(usdcBalance);
        } else {
          setUsdcBalance(0);
        }
      } catch (err) {
        console.error('Error fetching USDC balance:', err);
        setUsdcBalance(0);
      }

      // Get USD* balance
      try {
        // Check if the account exists first
        const accountInfo = await mainnetConnection.getAccountInfo(usdStarAta);
        if (accountInfo) {
          const usdStarBalanceResponse = await mainnetConnection.getTokenAccountBalance(usdStarAta);
          const usdStarBalance = usdStarBalanceResponse ? Number(usdStarBalanceResponse.value.uiAmount) : 0;
          setUsdStarBalance(usdStarBalance);
        } else {
          setUsdStarBalance(0);
        }
      } catch (err) {
        console.error('Error fetching USD* balance:', err);
        setUsdStarBalance(0);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError('Failed to fetch balances');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    // No interval refresh
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="text-center py-4">
        <p className="text-sm opacity-70">Please connect your wallet to view balances</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  // Format the public key for display
  const formatPubkey = (pubkey: PublicKey) => {
    const str = pubkey.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  return (
    <div className="space-y-4 rounded-lg border border-base-content/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Balances</h2>
        <button
          onClick={() => setIsBalancesVisible(!isBalancesVisible)}
          className="btn btn-ghost btn-sm btn-circle"
        >
          {isBalancesVisible ? (
            <EyeIcon className="h-5 w-5" />
          ) : (
            <EyeSlashIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="text-xs opacity-70 mb-2">
        Owner: {formatPubkey(publicKey)}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm">USDC Balance</span>
          <span>
            {isBalancesVisible 
              ? `${usdcBalance?.toFixed(6) ?? '0.000000'} USDC`
              : '••••••• USDC'
            }
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">PERENA USD* Balance</span>
          <span>
            {isBalancesVisible
              ? `${usdStarBalance?.toFixed(6) ?? '0.000000'} USD*`
              : '••••••• USD*'
            }
          </span>
        </div>
      </div>
    </div>
  );
}
