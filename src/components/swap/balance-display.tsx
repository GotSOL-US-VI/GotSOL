'use client';

import { useEffect, useState, useCallback, memo, useRef, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from "@getpara/react-sdk";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useConnection } from '@/lib/connection-context';
import { MainnetConnectionProvider } from '@/lib/mainnet-connection-provider';
import { toast } from 'react-hot-toast';

// Token addresses - using mainnet addresses directly since this is a mainnet-only component
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USD_STAR_MINT = new PublicKey('BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6');

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

// Rate limiting helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Memoized balance display component to prevent unnecessary re-renders
const BalanceDisplayContent = memo(({ 
  usdcBalance, 
  usdStarBalance, 
  isBalancesVisible, 
  publicKey 
}: { 
  usdcBalance: number | null, 
  usdStarBalance: number | null, 
  isBalancesVisible: boolean,
  publicKey: PublicKey
}) => {
  // Format the public key for display
  const formatPubkey = (pubkey: PublicKey) => {
    const str = pubkey.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  return (
    <div className="space-y-5 rounded-lg border border-base-content/10 p-5">
      <div className="text-base opacity-90 mb-3">
        Owner: <a 
          href={`https://solscan.io/account/${publicKey.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-mint hover:opacity-80 transition-opacity"
        >
          {formatPubkey(publicKey)}
        </a>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-base">USDC Balance</span>
          <span>
            {isBalancesVisible 
              ? `${usdcBalance?.toFixed(6) ?? '0.000000'} USDC`
              : '••••••• USDC'
            }
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-base">
            <a 
              href="https://app.perena.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mint hover:opacity-80 transition-opacity"
            >
              Perena USD*
            </a> Balance
          </span>
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
});

BalanceDisplayContent.displayName = 'BalanceDisplayContent';

// Inner component that uses the connection
function BalanceDisplayInner() {
  const { data: wallet } = useWallet();
  const { connection } = useConnection();
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [usdStarBalance, setUsdStarBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBalancesVisible, setIsBalancesVisible] = useState(true);
  
  // Add refs to track fetch state
  const isFetching = useRef(false);
  const mountedRef = useRef(true);

  // Get the public key from Para wallet's address field
  const publicKey = useMemo(() => 
    wallet?.address ? new PublicKey(wallet.address) : null
  , [wallet?.address]);

  // Log wallet changes only when they happen
  useEffect(() => {
    if (wallet?.address) {
      console.log('Para wallet data:', wallet);
      console.log('Derived public key:', publicKey?.toString());
    }
  }, [wallet?.address, publicKey]);

  const fetchBalances = useCallback(async () => {
    // Prevent concurrent fetches
    if (!publicKey || isFetching.current) return;
    
    try {
      isFetching.current = true;
      setError(null);
      console.log('Fetching balances for address:', publicKey.toString());

      // Get ATAs
      const [usdcAta, usdStarAta] = await Promise.all([
        findAssociatedTokenAddress(
          publicKey,
          USDC_MINT
        ),
        findAssociatedTokenAddress(
          publicKey,
          USD_STAR_MINT
        )
      ]);

      console.log('Found ATAs:', {
        USDC: usdcAta.toString(),
        'USD*': usdStarAta.toString()
      });

      // Get account infos in parallel
      const [usdcInfo, usdStarInfo] = await Promise.all([
        connection.getAccountInfo(usdcAta).catch(() => null),
        connection.getAccountInfo(usdStarAta).catch(() => null)
      ]);

      // Only fetch balances for existing accounts
      const [usdcBalance, usdStarBalance] = await Promise.all([
        usdcInfo ? connection.getTokenAccountBalance(usdcAta).catch(() => null) : Promise.resolve(null),
        usdStarInfo ? connection.getTokenAccountBalance(usdStarAta).catch(() => null) : Promise.resolve(null)
      ]);

      console.log('Fetched balances:', {
        USDC: usdcBalance?.value.uiAmount ?? 0,
        'USD*': usdStarBalance?.value.uiAmount ?? 0
      });

      // Only update state if component is still mounted
      if (mountedRef.current) {
        const newUsdcBalance = usdcBalance ? Number(usdcBalance.value.uiAmount) : 0;
        const newUsdStarBalance = usdStarBalance ? Number(usdStarBalance.value.uiAmount) : 0;
        
        setUsdcBalance(newUsdcBalance);
        setUsdStarBalance(newUsdStarBalance);
        setIsLoading(false);
      }

    } catch (err) {
      console.error('Error fetching balances:', err);
      if (mountedRef.current) {
        setError('Failed to fetch balances');
        setIsLoading(false);
      }
    } finally {
      isFetching.current = false;
      if (mountedRef.current) {
        setIsRefreshing(false);
        if (isRefreshing) {
          toast.success('Balances updated successfully');
        }
      }
    }
  }, [publicKey, connection, isRefreshing]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch only
    fetchBalances();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchBalances]);

  // Toggle visibility without triggering a re-fetch
  const toggleVisibility = useCallback(() => {
    setIsBalancesVisible(prev => !prev);
  }, []);

  // Add a manual refresh function
  const handleRefresh = useCallback(() => {
    if (!isFetching.current) {
      console.log('Manual refresh triggered');
      setIsRefreshing(true);
      fetchBalances();
    } else {
      console.log('Refresh skipped - already fetching');
    }
  }, [fetchBalances]);

  if (!publicKey) {
    return (
      <div className="text-center py-4">
        <p className="text-base opacity-70">Please connect your wallet to view balances</p>
      </div>
    );
  }

  if (isLoading && !isRefreshing) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Token Balances</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="btn btn-ghost btn-sm btn-circle"
            disabled={isFetching.current}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className={`w-5 h-5 transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <button
            onClick={toggleVisibility}
            className="btn btn-ghost btn-sm btn-circle"
          >
            {isBalancesVisible ? (
              <EyeIcon className="h-5 w-5" />
            ) : (
              <EyeSlashIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <BalanceDisplayContent 
        usdcBalance={usdcBalance}
        usdStarBalance={usdStarBalance}
        isBalancesVisible={isBalancesVisible}
        publicKey={publicKey}
      />
    </div>
  );
}

// Wrapper component that provides the mainnet connection
export function BalanceDisplay() {
  return (
    <div className="bg-base-100 rounded-3xl shadow-xl">
      <MainnetConnectionProvider>
        <BalanceDisplayInner />
      </MainnetConnectionProvider>
    </div>
  );
}
