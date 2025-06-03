'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, Idl } from '@coral-xyz/anchor';
import idl from '@/utils/gotsol.json';
import bs58 from 'bs58';
import { useEffect } from 'react';

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
const CACHE_TIMESTAMP_KEY = 'gotsol_merchant_cache_timestamp';
const CACHE_FRESHNESS_DURATION = 10 * 60 * 1000; // 10 minutes

// Enhanced logging utility to track component and call location for merchant operations
function logMerchantCall(operation: string, details?: any, component?: string) {
  const error = new Error();
  const stack = error.stack?.split('\n');
  
  // Find the calling component in the stack trace
  let callingComponent = component || 'Unknown';
  let callingLine = 'Unknown';
  
  if (stack) {
    for (let i = 1; i < stack.length; i++) {
      const line = stack[i];
      if (line.includes('.tsx') || line.includes('.ts')) {
        const match = line.match(/\/([^\/]+\.(tsx?|jsx?)):(\d+):\d+/);
        if (match) {
          callingComponent = match[1];
          callingLine = match[3];
          break;
        }
      }
    }
  }
  
  const timestamp = new Date().toISOString();
  console.log(
    `%c[${timestamp}] MERCHANT FINDER: ${operation}`,
    'color: #ff6b35; font-weight: bold;',
    `\n  📍 Component: ${callingComponent}:${callingLine}`,
    `\n  🔧 Hook: find-merchants`,
    details ? `\n  📊 Details: ${JSON.stringify(details, null, 2)}` : ''
  );
}

// Helper function to get cached merchants with timestamp check
function getCachedMerchants(walletAddress: string): { merchants: Merchant[] | null, isFresh: boolean } {
  if (typeof window === 'undefined') return { merchants: null, isFresh: false };
  
  logMerchantCall('Loading merchants from cache', { walletAddress });
  
  const cached = localStorage.getItem(`${MERCHANT_CACHE_KEY}_${walletAddress}`);
  const timestampStr = localStorage.getItem(`${CACHE_TIMESTAMP_KEY}_${walletAddress}`);
  
  if (!cached) {
    logMerchantCall('No cached merchants found', { walletAddress });
    return { merchants: null, isFresh: false };
  }

  const timestamp = timestampStr ? parseInt(timestampStr) : 0;
  const now = Date.now();
  const isFresh = (now - timestamp) < CACHE_FRESHNESS_DURATION;
  
  try {
    const parsed = JSON.parse(cached);
    // Convert string public keys back to PublicKey objects
    const merchants = parsed.map((m: any) => ({
      publicKey: new PublicKey(m.publicKey),
      account: {
        ...m.account,
        owner: new PublicKey(m.account.owner)
      }
    }));
    
    logMerchantCall('Cached merchants loaded successfully', { 
      walletAddress, 
      merchantCount: merchants.length,
      merchantNames: merchants.map((m: Merchant) => m.account.entityName),
      isFresh,
      cacheAge: Math.round((now - timestamp) / 1000 / 60) + ' minutes'
    });
    
    return { merchants, isFresh };
  } catch (e) {
    logMerchantCall('Error parsing cached merchants', { 
      walletAddress, 
      error: e instanceof Error ? e.message : e 
    });
    console.error('Error parsing cached merchants:', e);
    return { merchants: null, isFresh: false };
  }
}

// Helper function to cache merchants with timestamp
function cacheMerchants(walletAddress: string, merchants: Merchant[]) {
  if (typeof window === 'undefined') return;
  
  logMerchantCall('Caching merchants to localStorage', { 
    walletAddress, 
    merchantCount: merchants.length,
    merchantNames: merchants.map(m => m.account.entityName)
  });
  
  try {
    const now = Date.now();
    localStorage.setItem(
      `${MERCHANT_CACHE_KEY}_${walletAddress}`,
      JSON.stringify(merchants)
    );
    localStorage.setItem(
      `${CACHE_TIMESTAMP_KEY}_${walletAddress}`,
      now.toString()
    );
    logMerchantCall('Merchants cached successfully', { walletAddress });
  } catch (e) {
    logMerchantCall('Error caching merchants', { 
      walletAddress, 
      error: e instanceof Error ? e.message : e 
    });
    console.error('Error caching merchants:', e);
  }
}

// Batched account fetching to reduce RPC calls
async function batchedGetAccountInfo(connection: any, pubkeys: PublicKey[], batchSize: number = 5) {
  logMerchantCall('Starting batched account fetch', { 
    totalAccounts: pubkeys.length,
    batchSize 
  });
  
  const results: (any | null)[] = [];
  
  // Process in batches to avoid overwhelming the RPC
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    
    try {
      logMerchantCall('Fetching batch from RPC', { 
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        pubkeys: batch.map(pk => pk.toString().substring(0, 8) + '...')
      });
      
      // Use getMultipleAccountsInfo for batched fetching
      const batchResults = await connection.getMultipleAccountsInfo(batch);
      results.push(...batchResults);
      
      // Small delay between batches to be RPC-friendly
      if (i + batchSize < pubkeys.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      logMerchantCall('Batch fetch failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        batchNumber: Math.floor(i / batchSize) + 1
      });
      // Fill with nulls for failed batch
      results.push(...new Array(batch.length).fill(null));
    }
  }
  
  logMerchantCall('Batched fetch completed', { 
    totalResults: results.length,
    successfulFetches: results.filter(r => r !== null).length
  });
  
  return results;
}

async function getAccountInfo(connection: any, pubkey: PublicKey) {
  logMerchantCall('Fetching account info from RPC', { pubkey: pubkey.toString() });
  
  try {
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) {
      logMerchantCall('Account not found (was closed)', { pubkey: pubkey.toString() });
      return null; // Account no longer exists (was closed)
    }
    
    const coder = new BorshCoder(idl as Idl);
    const decoded = coder.accounts.decode('Merchant', accountInfo.data);

    const result = {
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
    
    logMerchantCall('Account info fetched successfully', { 
      pubkey: pubkey.toString(),
      entityName: result.account.entityName,
      isActive: result.account.is_active
    });
    
    return result;
  } catch (decodeError) {
    logMerchantCall('Error decoding account', { 
      pubkey: pubkey.toString(),
      error: decodeError instanceof Error ? decodeError.message : decodeError
    });
    console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
    return null;
  }
}

// Helper function to remove a merchant from cache
function removeMerchantFromCache(walletAddress: string, merchantPubkey: string) {
  if (typeof window === 'undefined') return;
  
  logMerchantCall('Removing merchant from cache', { walletAddress, merchantPubkey });
  
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
      // Update timestamp when cache is modified
      localStorage.setItem(
        `${CACHE_TIMESTAMP_KEY}_${walletAddress}`,
        Date.now().toString()
      );
      logMerchantCall('Merchant removed from cache successfully', { walletAddress, merchantPubkey });
    }
  } catch (e) {
    logMerchantCall('Error removing merchant from cache', { 
      walletAddress, 
      merchantPubkey,
      error: e instanceof Error ? e.message : e 
    });
    console.error('Error removing merchant from cache:', e);
  }
}

async function getNewMerchantAccounts(connection: any, programId: PublicKey, walletAddress: string, knownPubkeys: Set<string>) {
  logMerchantCall('Fetching new merchant accounts from RPC', { 
    walletAddress, 
    programId: programId.toString(),
    knownAccountsCount: knownPubkeys.size
  });
  
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
  
  logMerchantCall('RPC fetch completed', { 
    totalAccountsFound: allAccounts.length,
    newAccountsFound: newAccounts.length,
    knownAccountsCount: knownPubkeys.size
  });
  
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
        logMerchantCall('Error decoding new merchant account', { 
          pubkey: pubkey.toString(),
          error: decodeError instanceof Error ? decodeError.message : decodeError
        });
        console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
        return null;
      }
    })
  );

  const validMerchants = merchantAccounts.filter((m: Merchant | null): m is Merchant => m !== null);
  
  logMerchantCall('New merchant accounts processed', { 
    newAccountsProcessed: newAccounts.length,
    validMerchantsFound: validMerchants.length,
    merchantNames: validMerchants.map(m => m.account.entityName)
  });

  return validMerchants;
}

// Update the merchant account updating function
async function updateKnownMerchantAccounts(knownMerchants: Merchant[], connection: any) {
  if (knownMerchants.length === 0) return knownMerchants;
  
  logMerchantCall('Updating known merchant accounts', { 
    knownMerchantsCount: knownMerchants.length,
    merchantNames: knownMerchants.map(m => m.account.entityName)
  });

  const pubkeys = knownMerchants.map(m => m.publicKey);
  
  // Use batched fetching instead of individual calls
  const accountInfos = await batchedGetAccountInfo(connection, pubkeys, 5);
  
  const updatedMerchants: Merchant[] = [];
  const coder = new BorshCoder(idl as Idl);
  
  for (let i = 0; i < knownMerchants.length; i++) {
    const merchant = knownMerchants[i];
    const accountInfo = accountInfos[i];
    
    if (accountInfo) {
      try {
        const decodedData = coder.accounts.decode('Merchant', accountInfo.data);
        
        logMerchantCall('Account info fetched successfully', { 
          pubkey: merchant.publicKey.toString(),
          entityName: decodedData.entity_name,
          isActive: decodedData.is_active
        });
        
        updatedMerchants.push({
          publicKey: merchant.publicKey,
          account: {
            owner: decodedData.owner,
            entityName: decodedData.entity_name,
            total_withdrawn: decodedData.total_withdrawn.toNumber(),
            total_refunded: decodedData.total_refunded.toNumber(),
            merchant_bump: decodedData.merchant_bump,
            is_active: decodedData.is_active,
            refund_limit: decodedData.refund_limit.toNumber()
          }
        });
      } catch (error) {
        logMerchantCall('Failed to decode merchant account', { 
          pubkey: merchant.publicKey.toString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      logMerchantCall('No account info found', { 
        pubkey: merchant.publicKey.toString()
      });
    }
  }
  
  return updatedMerchants;
}

export async function fetchMerchantData(walletAddress: string | undefined, connection: any, forceRefresh = false, fetchNewAccounts = false) {
  if (!walletAddress || !connection) {
    logMerchantCall('fetchMerchantData skipped - missing requirements', { 
      hasWalletAddress: !!walletAddress, 
      hasConnection: !!connection 
    });
    return [];
  }

  logMerchantCall('fetchMerchantData started', { 
    walletAddress, 
    forceRefresh, 
    fetchNewAccounts 
  });

  const programId = new PublicKey(idl.address);
  
  // Get cached merchants with freshness check
  const { merchants: cachedMerchants, isFresh } = getCachedMerchants(walletAddress);
  
  // If we have fresh cached data and we're not forcing refresh, return cache immediately
  if (cachedMerchants && isFresh && !forceRefresh) {
    logMerchantCall('Returning fresh cached data without RPC calls', { 
      walletAddress,
      merchantCount: cachedMerchants.length,
      merchantNames: cachedMerchants.map(m => m.account.entityName)
    });
    return cachedMerchants.sort((a: Merchant, b: Merchant) =>
      a.account.entityName.localeCompare(b.account.entityName)
    );
  }

  let knownMerchants: Merchant[] = cachedMerchants || [];
  let updatedMerchants: Merchant[] = [];
  let newMerchants: Merchant[] = [];

  if (forceRefresh) {
    logMerchantCall('Performing full refresh', { walletAddress });
    
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
    if (cachedMerchants) {
      cachedMerchants.forEach(merchant => {
        if (!currentPubkeys.has(merchant.publicKey.toString())) {
          logMerchantCall('Removing deleted merchant from cache', { 
            merchantPubkey: merchant.publicKey.toString(),
            merchantName: merchant.account.entityName
          });
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
          logMerchantCall('Error decoding merchant account in full refresh', { 
            pubkey: pubkey.toString(),
            error: decodeError instanceof Error ? decodeError.message : decodeError
          });
          console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
          return null;
        }
      })
    );

    updatedMerchants = merchantAccounts.filter((m: Merchant | null): m is Merchant => m !== null);
    
    logMerchantCall('Full refresh completed', { 
      totalAccountsFound: allAccounts.length,
      validMerchantsDecoded: updatedMerchants.length,
      merchantNames: updatedMerchants.map(m => m.account.entityName)
    });
  } else {
    logMerchantCall('Performing incremental refresh on stale cache', { 
      walletAddress, 
      knownMerchantsCount: knownMerchants.length,
      cacheWasFresh: isFresh
    });
    
    // Stale cache refresh - update known accounts and check for new ones
    if (knownMerchants.length > 0) {
      logMerchantCall('Updating known merchant accounts', { 
        knownMerchantsCount: knownMerchants.length,
        merchantNames: knownMerchants.map(m => m.account.entityName)
      });
      
      // Update known accounts and check for deletions
      const updatedKnownMerchants = await updateKnownMerchantAccounts(knownMerchants, connection);
      updatedMerchants = updatedKnownMerchants;

      // Check for new accounts
      const knownPubkeys = new Set(knownMerchants.map(m => m.publicKey.toString()));
      newMerchants = await getNewMerchantAccounts(connection, programId, walletAddress, knownPubkeys);
    } else {
      logMerchantCall('No known accounts, performing full fetch', { walletAddress });
      
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
            logMerchantCall('Error decoding merchant account in full fetch', { 
              pubkey: pubkey.toString(),
              error: decodeError instanceof Error ? decodeError.message : decodeError
            });
            console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
            return null;
          }
        })
      );

      updatedMerchants = merchantAccounts.filter((m: Merchant | null): m is Merchant => m !== null);
      
      logMerchantCall('Full fetch completed', { 
        totalAccountsFound: allAccounts.length,
        validMerchantsDecoded: updatedMerchants.length,
        merchantNames: updatedMerchants.map(m => m.account.entityName)
      });
    }
  }

  // Combine all merchants
  const allMerchants = [...updatedMerchants, ...newMerchants];
  
  logMerchantCall('fetchMerchantData completed', { 
    totalMerchants: allMerchants.length,
    updatedMerchants: updatedMerchants.length,
    newMerchants: newMerchants.length,
    merchantNames: allMerchants.map(m => m.account.entityName)
  });
  
  // Cache the results with timestamp
  if (allMerchants.length > 0) {
    cacheMerchants(walletAddress, allMerchants);
  } else {
    // If no merchants left, clear the cache
    if (typeof window !== 'undefined') {
      logMerchantCall('No merchants found, clearing cache', { walletAddress });
      localStorage.removeItem(`${MERCHANT_CACHE_KEY}_${walletAddress}`);
      localStorage.removeItem(`${CACHE_TIMESTAMP_KEY}_${walletAddress}`);
    }
  }

  return allMerchants.sort((a: Merchant, b: Merchant) =>
    a.account.entityName.localeCompare(b.account.entityName)
  );
}

export function useMerchants(walletAddress?: string, connection?: any) {
  const queryClient = useQueryClient();

  // Enhanced logging for hook initialization
  useEffect(() => {
    logMerchantCall('useMerchants Hook Initialized', {
      walletAddress,
      hasConnection: !!connection
    });
  }, [walletAddress, connection]);

  const { data: merchants = [], isLoading: loading, error } = useQuery({
    queryKey: ['merchants', walletAddress],
    queryFn: () => {
      logMerchantCall('React Query fetchMerchantData triggered', { walletAddress });
      return fetchMerchantData(walletAddress, connection, false, false);
    },
    staleTime: CACHE_FRESHNESS_DURATION, // Use same freshness duration as cache (10 minutes)
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
    enabled: !!walletAddress && !!connection,
    refetchOnMount: false, // Never refetch on mount - rely on cache freshness
    refetchOnWindowFocus: false, // Never refetch on window focus
    refetchOnReconnect: false, // Never refetch on reconnect - rely on manual refresh
    retry: 1, // Reduce retries since we have cache fallback
  });

  // Add methods to control refresh behavior
  const forceRefresh = async () => {
    if (!walletAddress || !connection) {
      logMerchantCall('forceRefresh skipped - missing requirements', { 
        hasWalletAddress: !!walletAddress, 
        hasConnection: !!connection 
      });
      return;
    }
    
    logMerchantCall('forceRefresh started', { walletAddress });
    
    // Invalidate and refetch with force refresh
    await queryClient.invalidateQueries({ queryKey: ['merchants', walletAddress] });
    const freshData = await fetchMerchantData(walletAddress, connection, true, true);
    queryClient.setQueryData(['merchants', walletAddress], freshData);
    
    logMerchantCall('forceRefresh completed', { walletAddress });
  };

  const refreshKnownAccounts = async () => {
    if (!walletAddress || !connection) {
      logMerchantCall('refreshKnownAccounts skipped - missing requirements', { 
        hasWalletAddress: !!walletAddress, 
        hasConnection: !!connection 
      });
      return;
    }
    
    logMerchantCall('refreshKnownAccounts started', { walletAddress });
    
    // Invalidate and refetch without force refresh (will update stale cache)
    await queryClient.invalidateQueries({ queryKey: ['merchants', walletAddress] });
    const updatedData = await fetchMerchantData(walletAddress, connection, false, false);
    queryClient.setQueryData(['merchants', walletAddress], updatedData);
    
    logMerchantCall('refreshKnownAccounts completed', { walletAddress });
  };

  return { 
    merchants, 
    loading, 
    error: error ? (error as Error).message : null,
    forceRefresh, // Full refresh including new accounts
    refreshKnownAccounts // Only refresh known accounts
  };
} 