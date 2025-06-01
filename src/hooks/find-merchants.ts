'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, Idl } from '@coral-xyz/anchor';
import idl from '@/utils/gotsol.json';
import bs58 from 'bs58';

export interface MerchantAccount {
  owner: PublicKey;
  entityName: string;
  total_withdrawn: number;
  total_refunded: number;
  merchant_bump: number;
  is_active: boolean;
  refund_limit: number;
}

export interface Merchant {
  publicKey: PublicKey;
  account: MerchantAccount;
}

const MERCHANT_CACHE_KEY = 'gotsol_merchant_cache';

// Helper function to get cached merchants
function getCachedMerchants(walletAddress: string): Merchant[] | null {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem(`${MERCHANT_CACHE_KEY}_${walletAddress}`);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    // Convert string public keys back to PublicKey objects
    return parsed.map((m: any) => ({
      publicKey: new PublicKey(m.publicKey),
      account: {
        ...m.account,
        owner: new PublicKey(m.account.owner)
      }
    }));
  } catch (e) {
    console.error('Error parsing cached merchants:', e);
    return null;
  }
}

// Helper function to cache merchants
function cacheMerchants(walletAddress: string, merchants: Merchant[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${MERCHANT_CACHE_KEY}_${walletAddress}`,
      JSON.stringify(merchants)
    );
  } catch (e) {
    console.error('Error caching merchants:', e);
  }
}

async function getAccountInfo(connection: any, pubkey: PublicKey) {
  try {
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) return null; // Account no longer exists (was closed)
    
    const coder = new BorshCoder(idl as Idl);
    const decoded = coder.accounts.decode('Merchant', accountInfo.data);

    return {
      publicKey: pubkey,
      account: {
        owner: decoded.owner,
        entityName: decoded.entity_name,
        total_withdrawn: decoded.total_withdrawn.toNumber(),
        total_refunded: decoded.total_refunded.toNumber(),
        merchant_bump: decoded.merchant_bump,
        is_active: decoded.is_active,
        refund_limit: decoded.refund_limit.toNumber()
      },
    };
  } catch (decodeError) {
    console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
    return null;
  }
}

// Helper function to remove a merchant from cache
function removeMerchantFromCache(walletAddress: string, merchantPubkey: string) {
  if (typeof window === 'undefined') return;
  try {
    const cached = localStorage.getItem(`${MERCHANT_CACHE_KEY}_${walletAddress}`);
    if (cached) {
      const merchants = JSON.parse(cached);
      const updatedMerchants = merchants.filter(
        (m: any) => m.publicKey !== merchantPubkey
      );
      localStorage.setItem(
        `${MERCHANT_CACHE_KEY}_${walletAddress}`,
        JSON.stringify(updatedMerchants)
      );
    }
  } catch (e) {
    console.error('Error removing merchant from cache:', e);
  }
}

async function getNewMerchantAccounts(connection: any, programId: PublicKey, walletAddress: string, knownPubkeys: Set<string>) {
  // Get all accounts but only decode the ones we don't know about
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

  // Filter out accounts we already know about
  const newAccounts = allAccounts.filter(({ pubkey }: { pubkey: PublicKey }) => !knownPubkeys.has(pubkey.toString()));
  
  if (newAccounts.length === 0) return [];

  // Only decode the new accounts
  const merchantAccounts = await Promise.all(
    newAccounts.map(async ({ pubkey, account }: any) => {
      try {
        const coder = new BorshCoder(idl as Idl);
        const decoded = coder.accounts.decode('Merchant', account.data);

        return {
          publicKey: new PublicKey(pubkey),
          account: {
            owner: decoded.owner,
            entityName: decoded.entity_name,
            total_withdrawn: decoded.total_withdrawn.toNumber(),
            total_refunded: decoded.total_refunded.toNumber(),
            merchant_bump: decoded.merchant_bump,
            is_active: decoded.is_active,
            refund_limit: decoded.refund_limit.toNumber()
          },
        };
      } catch (decodeError) {
        console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
        return null;
      }
    })
  );

  return merchantAccounts.filter((m: Merchant | null): m is Merchant => m !== null);
}

export async function fetchMerchantData(walletAddress: string | undefined, connection: any, forceRefresh = false, fetchNewAccounts = false) {
  if (!walletAddress || !connection) {
    return [];
  }

  const programId = new PublicKey(idl.address);
  let knownMerchants: Merchant[] = [];
  let updatedMerchants: Merchant[] = [];
  let newMerchants: Merchant[] = [];

  // Get cached merchants first
  const cached = getCachedMerchants(walletAddress);
  if (cached) {
    knownMerchants = cached;
  }

  if (forceRefresh) {
    // Full refresh - get all accounts
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

    // Get all current account pubkeys
    const currentPubkeys = new Set(allAccounts.map(({ pubkey }: { pubkey: PublicKey }) => pubkey.toString()));
    
    // Remove any cached merchants that no longer exist
    if (cached) {
      cached.forEach(merchant => {
        if (!currentPubkeys.has(merchant.publicKey.toString())) {
          removeMerchantFromCache(walletAddress, merchant.publicKey.toString());
        }
      });
    }

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
              total_withdrawn: decoded.total_withdrawn.toNumber(),
              total_refunded: decoded.total_refunded.toNumber(),
              merchant_bump: decoded.merchant_bump,
              is_active: decoded.is_active,
              refund_limit: decoded.refund_limit.toNumber()
            },
          };
        } catch (decodeError) {
          console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
          return null;
        }
      })
    );

    updatedMerchants = merchantAccounts.filter((m: Merchant | null): m is Merchant => m !== null);
  } else {
    // Normal refresh - update known accounts and check for new ones
    if (knownMerchants.length > 0) {
      // Update known accounts and check for deletions
      const updatedKnownMerchants = await Promise.all(
        knownMerchants.map(async merchant => {
          const updated = await getAccountInfo(connection, merchant.publicKey);
          if (!updated) {
            // Account was closed, remove from cache
            removeMerchantFromCache(walletAddress, merchant.publicKey.toString());
          }
          return updated;
        })
      );
      updatedMerchants = updatedKnownMerchants.filter((m: Merchant | null): m is Merchant => m !== null);

      // Check for new accounts
      const knownPubkeys = new Set(knownMerchants.map(m => m.publicKey.toString()));
      newMerchants = await getNewMerchantAccounts(connection, programId, walletAddress, knownPubkeys);
    } else {
      // No known accounts, do a full fetch
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
                total_withdrawn: decoded.total_withdrawn.toNumber(),
                total_refunded: decoded.total_refunded.toNumber(),
                merchant_bump: decoded.merchant_bump,
                is_active: decoded.is_active,
                refund_limit: decoded.refund_limit.toNumber()
              },
            };
          } catch (decodeError) {
            console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
            return null;
          }
        })
      );

      updatedMerchants = merchantAccounts.filter((m: Merchant | null): m is Merchant => m !== null);
    }
  }

  // Combine all merchants
  const allMerchants = [...updatedMerchants, ...newMerchants];
  
  // Cache the results
  if (allMerchants.length > 0) {
    cacheMerchants(walletAddress, allMerchants);
  } else {
    // If no merchants left, clear the cache
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${MERCHANT_CACHE_KEY}_${walletAddress}`);
    }
  }

  return allMerchants.sort((a: Merchant, b: Merchant) =>
    a.account.entityName.localeCompare(b.account.entityName)
  );
}

export function useMerchants(walletAddress?: string, connection?: any) {
  const queryClient = useQueryClient();

  const { data: merchants = [], isLoading: loading, error } = useQuery({
    queryKey: ['merchants', walletAddress],
    queryFn: () => fetchMerchantData(walletAddress, connection, false, false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!walletAddress && !!connection,
    refetchOnMount: true,
  });

  // Add methods to control refresh behavior
  const forceRefresh = async () => {
    if (!walletAddress || !connection) return;
    await queryClient.invalidateQueries({ queryKey: ['merchants', walletAddress] });
    await fetchMerchantData(walletAddress, connection, true, true);
  };

  const refreshKnownAccounts = async () => {
    if (!walletAddress || !connection) return;
    await queryClient.invalidateQueries({ queryKey: ['merchants', walletAddress] });
    await fetchMerchantData(walletAddress, connection, false, false);
  };

  return { 
    merchants, 
    loading, 
    error: error ? (error as Error).message : null,
    forceRefresh, // Full refresh including new accounts
    refreshKnownAccounts // Only refresh known accounts
  };
} 