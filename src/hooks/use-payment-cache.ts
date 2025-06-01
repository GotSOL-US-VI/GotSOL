'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';

interface Payment {
  signature: string;
  amount: number;
  memo: string | null;
  timestamp: number;
  sender: PublicKey;
}

interface SerializedPayment {
  signature: string;
  amount: number;
  memo: string | null;
  timestamp: number;
  sender: string; // PublicKey as string
}

interface PaymentCacheData {
  payments: SerializedPayment[];
  lastUpdated: number;
  merchantPubkey: string;
  isDevnet: boolean;
  totalPaymentsEverSeen?: number; // Track total for analytics
}

// Cache configuration
const CACHE_CONFIG = {
  MAX_PAYMENTS: 200, // Maximum number of payments to keep in cache
  MAX_AGE_DAYS: 90, // Maximum age of payments to keep (90 days)
  PRUNE_TO_COUNT: 150, // When pruning, reduce to this many payments
  MIN_RECENT_PAYMENTS: 50, // Always keep at least this many recent payments
} as const;

/**
 * Prune old payments based on count and age limits
 */
function prunePayments(payments: Payment[]): Payment[] {
  if (payments.length <= CACHE_CONFIG.MAX_PAYMENTS) {
    return payments;
  }

  // Sort by timestamp descending (newest first)
  const sortedPayments = [...payments].sort((a, b) => b.timestamp - a.timestamp);
  
  // Calculate age cutoff (90 days ago)
  const ageCutoff = Date.now() - (CACHE_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  
  // First, filter by age (but keep minimum recent payments)
  const recentPayments = sortedPayments.filter((payment, index) => 
    payment.timestamp > ageCutoff || index < CACHE_CONFIG.MIN_RECENT_PAYMENTS
  );
  
  // Then, limit by count
  const finalPayments = recentPayments.slice(0, CACHE_CONFIG.PRUNE_TO_COUNT);
  
  const prunedCount = payments.length - finalPayments.length;
  if (prunedCount > 0) {
    console.log(`Pruned ${prunedCount} old payments from cache (keeping ${finalPayments.length} recent payments)`);
  }
  
  return finalPayments;
}

/**
 * Get cache statistics for monitoring
 */
function getCacheStats(payments: Payment[]): { oldestPayment: Date | null; newestPayment: Date | null; totalCount: number; avgAge: number } {
  if (payments.length === 0) {
    return { oldestPayment: null, newestPayment: null, totalCount: 0, avgAge: 0 };
  }
  
  const timestamps = payments.map(p => p.timestamp);
  const oldest = Math.min(...timestamps);
  const newest = Math.max(...timestamps);
  const avgAge = (Date.now() - (timestamps.reduce((a, b) => a + b, 0) / timestamps.length)) / (24 * 60 * 60 * 1000);
  
  return {
    oldestPayment: new Date(oldest),
    newestPayment: new Date(newest),
    totalCount: payments.length,
    avgAge: Math.round(avgAge * 10) / 10 // Round to 1 decimal
  };
}

/**
 * Custom hook to handle payment data persistence in localStorage
 * This provides an additional layer of persistence beyond React Query caching
 */
export function usePaymentCache(merchantPubkey: PublicKey | null, isDevnet: boolean = true) {
  const queryClient = useQueryClient();
  const cacheKey = merchantPubkey ? `payments-${merchantPubkey.toString()}-${isDevnet ? 'devnet' : 'mainnet'}` : null;
  
  // Load payments from localStorage when component mounts
  useEffect(() => {
    if (!cacheKey) return;
    
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData) as PaymentCacheData;
        
        // Validate cache data structure
        if (parsedData.payments && Array.isArray(parsedData.payments)) {
          // Convert serialized PublicKey back to PublicKey objects
          const payments = parsedData.payments.map((payment: SerializedPayment) => ({
            ...payment,
            sender: new PublicKey(payment.sender)
          }));
          
          // Set the payments in React Query cache
          queryClient.setQueryData(['payments', merchantPubkey?.toString(), isDevnet], payments);
          
          console.log(`Loaded ${payments.length} cached payments from localStorage (last updated: ${new Date(parsedData.lastUpdated).toLocaleString()})`);
        }
      }
    } catch (error) {
      console.error('Error loading cached payments:', error);
    }
  }, [cacheKey, queryClient, merchantPubkey, isDevnet]);
  
  // Save payments to localStorage when data changes
  const savePaymentsToCache = useCallback((payments: Payment[]): void => {
    if (!cacheKey || !merchantPubkey) return;
    
    try {
      // Prune old payments before saving
      const prunedPayments = prunePayments(payments);
      
      // Get cache statistics
      const stats = getCacheStats(prunedPayments);
      
      // Prepare data for serialization (convert PublicKey to string)
      const serializedData: SerializedPayment[] = prunedPayments.map(payment => ({
        ...payment,
        sender: payment.sender.toString()
      }));
      
      const cacheData: PaymentCacheData = {
        payments: serializedData,
        lastUpdated: Date.now(),
        merchantPubkey: merchantPubkey.toString(),
        isDevnet,
        totalPaymentsEverSeen: Math.max(payments.length, prunedPayments.length)
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      console.log(`Saved ${prunedPayments.length} payments to localStorage cache`);
      if (stats.totalCount > 0) {
        console.log(`Cache stats: ${stats.totalCount} payments, oldest: ${stats.oldestPayment?.toLocaleDateString()}, avg age: ${stats.avgAge} days`);
      }
    } catch (error) {
      console.error('Error saving payments to cache:', error);
    }
  }, [cacheKey, merchantPubkey, isDevnet]);
  
  return { savePaymentsToCache };
}

export function usePaymentRefresh(merchantPubkey: PublicKey | null, isDevnet: boolean = true) {
  const queryClient = useQueryClient();
  const forceRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const forceRefresh = useCallback(async () => {
    if (!merchantPubkey) {
      console.warn('Cannot refresh payments: merchantPubkey is null');
      return;
    }
    
    if (forceRefreshRef.current) {
      await forceRefreshRef.current();
    } else {
      // Fallback: use incremental refresh logic if PaymentHistory hasn't set up the ref yet
      try {
        // Get existing payment data from cache
        const existingPayments = queryClient.getQueryData<Payment[]>(
          ['payments', merchantPubkey.toString(), isDevnet]
        ) || [];
        
        // If we have existing payments, just invalidate and let the component handle incremental refresh
        // Otherwise, do a full invalidation
        if (existingPayments.length > 0) {
          console.log('Fallback: Invalidating payment cache for incremental refresh...');
        } else {
          console.log('Fallback: Full payment cache invalidation...');
        }
        
        await queryClient.invalidateQueries({
          queryKey: ['payments', merchantPubkey.toString(), isDevnet],
          refetchType: 'active'
        });
        
        await queryClient.invalidateQueries({
          queryKey: ['usdc-balance', merchantPubkey.toString(), isDevnet],
          refetchType: 'active'
        });
      } catch (error) {
        console.error('Error in fallback payment refresh:', error);
      }
    }
  }, [queryClient, merchantPubkey, isDevnet]);

  return {
    forceRefresh,
    forceRefreshRef
  };
} 