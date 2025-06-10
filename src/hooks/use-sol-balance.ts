import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { useQuery } from '@tanstack/react-query';

interface UseSolBalanceProps {
  address: PublicKey;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}

interface SolBalanceData {
  solBalance: number;
  usdBalance: number;
  solPrice: number;
  priceExpiresAt: number;
}

/**
 * Hook for fetching SOL balance with USD conversion
 * Handles native SOL account balance and price fetching
 */
export function useSolBalance({
  address,
  enabled = true,
  staleTime = 2000,
  refetchInterval = false,
  refetchOnMount = true,
  refetchOnWindowFocus = true
}: UseSolBalanceProps) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ['sol-balance', address.toString()],
    queryFn: async (): Promise<SolBalanceData> => {
      // Fetch SOL balance (native balance)
      const lamports = await connection.getBalance(address);
      const solBalance = lamports / 1_000_000_000; // Convert lamports to SOL (9 decimals)

      // Fetch SOL price from CoinGecko (free tier)
      try {
        const priceResponse = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_last_updated_at=true'
        );
        
        if (!priceResponse.ok) {
          throw new Error('Failed to fetch SOL price');
        }

        const priceData = await priceResponse.json();
        const solPrice = priceData.solana?.usd || 0;
        const lastUpdated = priceData.solana?.last_updated_at || Date.now() / 1000;
        
        // Price expires in 60 seconds (CoinGecko free tier updates frequently)
        const priceExpiresAt = (lastUpdated * 1000) + (60 * 1000);
        
        const usdBalance = solBalance * solPrice;

        return {
          solBalance,
          usdBalance,
          solPrice,
          priceExpiresAt
        };
      } catch (priceError) {
        console.warn('Failed to fetch SOL price, using balance only:', priceError);
        
        // Fallback: return SOL balance without USD conversion
        return {
          solBalance,
          usdBalance: 0,
          solPrice: 0,
          priceExpiresAt: Date.now() + (60 * 1000)
        };
      }
    },
    enabled: enabled && !!connection && !!address,
    staleTime,
    refetchInterval,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}

/**
 * Hook for just fetching SOL price (useful for conversions)
 */
export function useSolPrice() {
  return useQuery({
    queryKey: ['sol-price'],
    queryFn: async () => {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_last_updated_at=true'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch SOL price');
      }

      const data = await response.json();
      return {
        price: data.solana?.usd || 0,
        lastUpdated: data.solana?.last_updated_at || Date.now() / 1000,
        expiresAt: (data.solana?.last_updated_at * 1000) + (60 * 1000)
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
} 