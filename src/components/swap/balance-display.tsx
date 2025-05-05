'use client';

import { useEffect, useState, useCallback, memo, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from "@getpara/react-sdk";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useConnection } from '@/lib/connection-context';
import { MainnetConnectionProvider } from '@/lib/mainnet-connection-provider';

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
    <div className="space-y-4 rounded-lg border border-base-content/10 p-4">
      <div className="text-sm opacity-90 mb-2">
        Owner: <a 
          href={`https://solscan.io/account/${publicKey.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-mint hover:opacity-80 transition-opacity"
        >
          {formatPubkey(publicKey)}
        </a>
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
          <span className="text-sm">
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
  const [error, setError] = useState<string | null>(null);
  const [isBalancesVisible, setIsBalancesVisible] = useState(true);
  
  // Add refs to track fetch state
  const isFetching = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  const publicKey = wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;

  const fetchBalances = useCallback(async () => {
    // Prevent concurrent fetches
    if (!publicKey || isFetching.current) return;
    
    try {
      isFetching.current = true;
      setError(null);

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

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setUsdcBalance(usdcBalance ? Number(usdcBalance.value.uiAmount) : 0);
        setUsdStarBalance(usdStarBalance ? Number(usdStarBalance.value.uiAmount) : 0);
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
    }
  }, [publicKey, connection]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Initial fetch
    fetchBalances();

    // Set up polling with debounce
    timeoutRef.current = setInterval(() => {
      if (!isFetching.current) {
        fetchBalances();
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };
  }, [fetchBalances]);

  // Toggle visibility without triggering a re-fetch
  const toggleVisibility = useCallback(() => {
    setIsBalancesVisible(prev => !prev);
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Balances</h2>
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
    <div className="bg-base-100 rounded-3xl shadow-xl p-6">
      <MainnetConnectionProvider>
      <BalanceDisplayInner />
      </MainnetConnectionProvider>
    </div>
  );
}
