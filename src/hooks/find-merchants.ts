'use client';

import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, Idl } from '@coral-xyz/anchor';
import idl from '@/utils/gotsol.json';
import bs58 from 'bs58';

export interface MerchantAccount {
  owner: PublicKey;
  entityName: string;
  merchant_bump: number;
  fee_eligible: boolean;
}

export interface Merchant {
  publicKey: PublicKey;
  account: MerchantAccount;
}

// Export the function so it can be used for prefetching
export async function fetchMerchantData(walletAddress: string | undefined, connection: any) {
  if (!walletAddress || !connection) {
    return [];
  }
  
  const programId = new PublicKey(idl.address);
  
  const allAccounts = await connection.getProgramAccounts(
    programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(Buffer.from([71, 235, 30, 40, 231, 21, 32, 64]))
          }
        },
        {
          memcmp: {
            offset: 8,
            bytes: walletAddress
          }
        }
      ]
    }
  );

  const merchantAccounts = await Promise.all(
    allAccounts.map(async ({ pubkey, account }: any) => {
      try {
        const coder = new BorshCoder(idl as Idl);
        const decoded = coder.accounts.decode('Merchant', account.data);

        return {
          publicKey: new PublicKey(pubkey),
          account: {
            owner: decoded.owner,
            entityName: decoded.entity_name,
            merchant_bump: decoded.merchant_bump,
            fee_eligible: decoded.fee_eligible
          },
        };
      } catch (decodeError) {
        console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
        return null;
      }
    })
  );

  const validMerchants = merchantAccounts
    .filter((m: Merchant | null): m is Merchant => m !== null);

  return validMerchants.sort((a: Merchant, b: Merchant) =>
    a.account.entityName.localeCompare(b.account.entityName)
  );
}

export function useMerchants(walletAddress?: string, connection?: any) {
  const { data: merchants = [], isLoading: loading, error } = useQuery({
    queryKey: ['merchants', walletAddress],
    queryFn: () => fetchMerchantData(walletAddress, connection),
    staleTime: 30 * 1000, // Consider data stale after 30 seconds (reduced from 5 minutes)
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!walletAddress && !!connection,
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  return { 
    merchants, 
    loading, 
    error: error ? (error as Error).message : null 
  };
} 