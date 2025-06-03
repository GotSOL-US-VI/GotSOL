'use client';

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { debounceAsync, throttle } from '@/utils/debounce';
import { safePublicKeyToString, safeJsonStringify } from '@/utils/safe-publickey';

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
  cacheExpiry: number; // Add cache expiration timestamp
  version: number; // Cache version for breaking changes
}

// Cache configuration
const CACHE_CONFIG = {
  MAX_PAYMENTS: 200, // Maximum number of payments to keep in cache
  MAX_AGE_DAYS: 90, // Maximum age of payments to keep (90 days)
  PRUNE_TO_COUNT: 150, // When pruning, reduce to this many payments
  MIN_RECENT_PAYMENTS: 50, // Always keep at least this many recent payments
  EXPIRY_DURATION: 5 * 60 * 1000, // Cache expires after 5 minutes of no updates
  MAX_AGE: 30 * 60 * 1000, // Maximum age before forcing refresh (30 minutes)
  VERSION: 1 // Current cache version
} as const;

// Enhanced logging utility for debugging and optimization
function logComponentCall(operation: string, details?: any, component?: string) {
  try {
    const timestamp = new Date().toISOString();
    
    // Color code different types of operations for easy scanning
    let color = '#00ff88'; // Default green
    let prefix = 'INFO';
    
    if (operation.includes('Error') || operation.includes('Failed')) {
      color = '#ff6b6b'; // Red for errors
      prefix = 'ERROR';
    } else if (operation.includes('Hook Initialized') || operation.includes('Refresh function registered')) {
      color = '#4ecdc4'; // Teal for initialization
      prefix = 'INIT';
    } else if (operation.includes('Force Refresh') || operation.includes('Using component-specific')) {
      color = '#ffe66d'; // Yellow for refresh operations
      prefix = 'REFRESH';
    } else if (operation.includes('Cache') || operation.includes('localStorage')) {
      color = '#a8e6cf'; // Light green for cache operations
      prefix = 'CACHE';
    }
    
    console.log(
      `%c[${timestamp}] ${prefix} PAYMENT CACHE: ${operation}`,
      `color: ${color}; font-weight: bold;`
    );
    
    // Show details for debugging operations (but not for routine cache saves)
    if (details && (
      operation.includes('Hook Initialized') ||
      operation.includes('Force Refresh') ||
      operation.includes('Error') ||
      operation.includes('Failed') ||
      operation.includes('Invalid cache')
    )) {
      console.log(`%c  Details:`, `color: ${color}; opacity: 0.8;`, details);
    }
    
    // Add component context if provided
    if (component) {
      console.log(`%c  Component: ${component}`, `color: ${color}; opacity: 0.6;`);
    }
    
  } catch (logError) {
    // Fallback logging if there's an error in the logging function itself
    console.error('Payment cache logging error:', logError);
  }
}

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

function isValidCache(cacheData: PaymentCacheData): boolean {
  const now = Date.now();
  
  // Check version compatibility
  if (cacheData.version !== CACHE_CONFIG.VERSION) {
    logComponentCall('Cache version mismatch, invalidating', {
      cachedVersion: cacheData.version,
      currentVersion: CACHE_CONFIG.VERSION
    });
    return false;
  }
  
  // Check if cache has expired
  if (cacheData.cacheExpiry && now > cacheData.cacheExpiry) {
    logComponentCall('Cache expired, invalidating', {
      cacheExpiry: new Date(cacheData.cacheExpiry).toISOString(),
      currentTime: new Date(now).toISOString()
    });
    return false;
  }
  
  // Check maximum age
  if (now - cacheData.lastUpdated > CACHE_CONFIG.MAX_AGE) {
    logComponentCall('Cache too old, invalidating', {
      lastUpdated: new Date(cacheData.lastUpdated).toISOString(),
      ageMs: now - cacheData.lastUpdated,
      maxAgeMs: CACHE_CONFIG.MAX_AGE
    });
    return false;
  }
  
  return true;
}

const PAYMENT_CACHE_PREFIX = 'gotsol_payments_';

export function usePaymentCache(merchantPubkey: PublicKey | null, isDevnet: boolean) {
  const cacheKey = merchantPubkey ? `${PAYMENT_CACHE_PREFIX}${merchantPubkey.toString()}_${isDevnet}` : null;
  
  const savePaymentsToCache = useCallback((payments: Payment[]) => {
    if (!cacheKey || typeof window === 'undefined') return;
    
    try {
      // Save with timestamp for cache validation
      const cacheData = {
        payments: payments.map(p => ({
          ...p,
          sender: p.sender.toString() // Serialize PublicKey
        })),
        timestamp: Date.now(),
        version: '2.0' // Version for cache invalidation if needed
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving payments to cache:', error);
    }
  }, [cacheKey]);

  const getPaymentsFromCache = useCallback((): Payment[] | null => {
    if (!cacheKey || typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      
      // Convert string PublicKeys back to PublicKey objects
      return cacheData.payments.map((p: any) => ({
        ...p,
        sender: new PublicKey(p.sender)
      }));
    } catch (error) {
      console.error('Error loading payments from cache:', error);
      return null;
    }
  }, [cacheKey]);

  const clearPaymentCache = useCallback(() => {
    if (!cacheKey || typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing payment cache:', error);
    }
  }, [cacheKey]);

  const addPaymentToCache = useCallback((newPayment: Payment) => {
    if (!cacheKey || typeof window === 'undefined') return;
    
    const existingPayments = getPaymentsFromCache() || [];
    
    // Check if payment already exists
    if (existingPayments.some(p => p.signature === newPayment.signature)) {
      return;
    }
    
    // Add new payment at the beginning and keep max 50
    const updatedPayments = [newPayment, ...existingPayments].slice(0, 50);
    savePaymentsToCache(updatedPayments);
  }, [cacheKey, getPaymentsFromCache, savePaymentsToCache]);

  const getCachedPayments = useCallback((maxPayments?: number): Payment[] => {
    const cached = getPaymentsFromCache() || [];
    return maxPayments ? cached.slice(0, maxPayments) : cached;
  }, [getPaymentsFromCache]);

  const getMostRecentTimestamp = useCallback((): number | null => {
    const cached = getPaymentsFromCache();
    if (!cached || cached.length === 0) return null;
    
    return Math.max(...cached.map(p => p.timestamp));
  }, [getPaymentsFromCache]);

  return {
    savePaymentsToCache,
    getPaymentsFromCache,
    clearPaymentCache,
    addPaymentToCache,
    getCachedPayments,
    getMostRecentTimestamp
  };
}

// Hook for payment refresh control
export function usePaymentRefresh(merchantPubkey: PublicKey | null, isDevnet: boolean) {
  const { clearPaymentCache } = usePaymentCache(merchantPubkey, isDevnet);
  const refreshFunctionRef = useRef<(() => Promise<void>) | null>(null);

  const setRefreshFunction = useCallback((fn: (() => Promise<void>) | null) => {
    refreshFunctionRef.current = fn;
  }, []);

  const forceRefresh = useCallback(async () => {
    if (refreshFunctionRef.current) {
      await refreshFunctionRef.current();
    }
  }, []);

  const clearCacheAndNavigateHome = useCallback(() => {
    clearPaymentCache();
  }, [clearPaymentCache]);

  return {
    forceRefresh,
    setRefreshFunction,
    clearCacheAndNavigateHome
  };
} 