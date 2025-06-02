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

/**
 * Custom hook to handle payment data persistence in localStorage
 * This provides an additional layer of persistence beyond React Query caching
 */
export function usePaymentCache(merchantPubkey: PublicKey | null, isDevnet: boolean = true) {
  const queryClient = useQueryClient();
  const cacheKey = merchantPubkey ? `payments-${safePublicKeyToString(merchantPubkey)}-${isDevnet ? 'devnet' : 'mainnet'}` : null;
  const isLoadingRef = useRef(false);
  const lastSavedHashRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get component name from call stack for debugging
  const getCallerComponent = () => {
    try {
      const stack = new Error().stack;
      const stackLines = stack?.split('\n') || [];
      // Look for component names in the stack
      for (let line of stackLines) {
        if (line.includes('Content') || line.includes('Dashboard') || line.includes('Component')) {
          const match = line.match(/(\w+Content|\w+Dashboard|\w+Component)/);
          return match ? match[1] : 'Unknown';
        }
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  };
  
  // Restore hook initialization logging with component tracking
  useEffect(() => {
    const callerComponent = getCallerComponent();
    logComponentCall('Hook Initialized', {
      merchantPubkey: safePublicKeyToString(merchantPubkey),
      isDevnet,
      cacheKey
    }, callerComponent);
  }, [merchantPubkey, isDevnet, cacheKey]);
  
  // Load payments from localStorage when component mounts
  useEffect(() => {
    if (!cacheKey) return;
    
    logComponentCall('Loading from localStorage', { cacheKey });
    
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData) as PaymentCacheData;
        
        // Validate cache before using
        if (!isValidCache(parsedData)) {
          logComponentCall('Invalid cache detected, clearing', { cacheKey });
          localStorage.removeItem(cacheKey);
          isLoadingRef.current = false;
          return;
        }
        
        // Validate cache data structure
        if (parsedData.payments && Array.isArray(parsedData.payments)) {
          // Convert serialized PublicKey back to PublicKey objects
          const payments = parsedData.payments.map((payment: SerializedPayment) => ({
            ...payment,
            sender: new PublicKey(payment.sender)
          }));
          
          // Set flag to prevent the loading from triggering unnecessary saves
          isLoadingRef.current = true;
          
          // Set the payments in React Query cache
          queryClient.setQueryData(['payments', safePublicKeyToString(merchantPubkey), isDevnet], payments);
          
          // Update the hash to prevent immediate re-save
          const currentHash = JSON.stringify(payments.map(p => p.signature).sort());
          lastSavedHashRef.current = currentHash;
          
          logComponentCall('Cache Loaded Successfully', {
            paymentsCount: payments.length,
            lastUpdated: new Date(parsedData.lastUpdated).toLocaleString(),
            cacheKey
          });
          
          // Reset flag after a brief delay to allow the effect to settle
          setTimeout(() => {
            isLoadingRef.current = false;
          }, 100);
        }
      } else {
        logComponentCall('No cached data found', { cacheKey });
      }
    } catch (error) {
      logComponentCall('Error loading cached payments', { error: error instanceof Error ? error.message : error, cacheKey });
      isLoadingRef.current = false;
    }
  }, [cacheKey, queryClient, merchantPubkey, isDevnet]);
  
  // Create a stable reference to prevent unnecessary re-renders
  const savePaymentsToCache = useCallback((payments: Payment[]): void => {
    if (!cacheKey || !merchantPubkey) {
      return;
    }
    
    // Skip saving if we're currently loading from cache to prevent race conditions
    if (isLoadingRef.current) {
      return;
    }
    
    // Create a simple hash to detect actual changes
    const currentHash = JSON.stringify(payments.map(p => p.signature).sort());
    
    // Only save if the data has actually changed
    if (currentHash === lastSavedHashRef.current) {
      return; // No change, skip save
    }
    
    // Debounce the save operation (save at most once every 5 seconds)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Double-check the hash hasn't changed during debounce period
        const finalHash = JSON.stringify(payments.map(p => p.signature).sort());
        if (finalHash === lastSavedHashRef.current) {
          return;
        }
        
        logComponentCall('Saving to localStorage', { 
          paymentsCount: payments.length,
          cacheKey,
          reason: 'Data changed'
        });
        
        // Prune old payments before saving
        const prunedPayments = prunePayments(payments);
        
        // Get cache statistics
        const stats = getCacheStats(prunedPayments);
        
        // Prepare data for serialization (convert PublicKey to string)
        const serializedData: SerializedPayment[] = prunedPayments.map(payment => ({
          ...payment,
          sender: safePublicKeyToString(payment.sender)
        }));
        
        const cacheData: PaymentCacheData = {
          payments: serializedData,
          lastUpdated: Date.now(),
          merchantPubkey: safePublicKeyToString(merchantPubkey),
          isDevnet,
          totalPaymentsEverSeen: Math.max(payments.length, prunedPayments.length),
          cacheExpiry: Date.now() + CACHE_CONFIG.EXPIRY_DURATION,
          version: CACHE_CONFIG.VERSION
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        // Update the saved hash
        lastSavedHashRef.current = finalHash;
        
        logComponentCall('Cache Saved Successfully', {
          savedCount: prunedPayments.length,
          originalCount: payments.length,
          stats,
          cacheKey
        });
      } catch (error) {
        logComponentCall('Error saving payments to cache', { 
          error: error instanceof Error ? error.message : error, 
          cacheKey 
        });
      }
    }, 5000); // Debounce for 5 seconds
    
  }, [cacheKey, merchantPubkey, isDevnet]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  return { savePaymentsToCache };
}

export function usePaymentRefresh(merchantPubkey: PublicKey | null, isDevnet: boolean = true) {
  const queryClient = useQueryClient();
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  
  // Get component name for tracking
  const getCallerComponent = () => {
    try {
      const stack = new Error().stack;
      const stackLines = stack?.split('\n') || [];
      for (let line of stackLines) {
        if (line.includes('Content') || line.includes('Dashboard') || line.includes('Component')) {
          const match = line.match(/(\w+Content|\w+Dashboard|\w+Component)/);
          return match ? match[1] : 'Unknown';
        }
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  // Initialize with component tracking
  useEffect(() => {
    const callerComponent = getCallerComponent();
    logComponentCall('Refresh Hook Initialized', { 
      merchantPubkey: safePublicKeyToString(merchantPubkey),
      isDevnet 
    }, callerComponent);
  }, [merchantPubkey, isDevnet]);

  // Enhanced logging for refresh operations
  const logRefreshOperation = useCallback((operation: string, details?: any) => {
    const callerComponent = getCallerComponent();
    logComponentCall(operation, details, callerComponent);
  }, []);

  // Debounced force refresh function to prevent spam
  const forceRefresh = useCallback(async () => {
    if (!merchantPubkey) return;

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    
    // Log refresh attempt with timing info
    logRefreshOperation('Force Refresh Starting', { 
      merchantPubkey: safePublicKeyToString(merchantPubkey),
      isDevnet,
      hasRefreshRef: !!refreshRef.current,
      timeSinceLastRefresh,
      isCurrentlyRefreshing: isRefreshingRef.current
    });
    
    // Prevent excessive refreshing - minimum 2 seconds between refreshes
    if (isRefreshingRef.current || timeSinceLastRefresh < 2000) {
      logRefreshOperation('Force Refresh Skipped', {
        reason: isRefreshingRef.current ? 'Already refreshing' : 'Too soon (< 2s)',
        timeSinceLastRefresh
      });
      return;
    }

    isRefreshingRef.current = true;
    lastRefreshTimeRef.current = now;

    try {
      if (refreshRef.current) {
        logRefreshOperation('Using component-specific refresh function');
        await refreshRef.current();
      } else {
        logRefreshOperation('Using React Query invalidation fallback');
        // Fallback to invalidating queries
        const merchantPubkeyString = safePublicKeyToString(merchantPubkey);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['payments', merchantPubkeyString, isDevnet],
            refetchType: 'active'
          }),
          queryClient.invalidateQueries({
            queryKey: ['token-balance', merchantPubkeyString],
            refetchType: 'active'
          })
        ]);
      }

      logRefreshOperation('Force Refresh Completed Successfully', { 
        merchantPubkey: safePublicKeyToString(merchantPubkey),
        duration: Date.now() - now
      });
    } catch (error) {
      logRefreshOperation('Force Refresh Failed', { 
        merchantPubkey: safePublicKeyToString(merchantPubkey),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [merchantPubkey, isDevnet, queryClient, logRefreshOperation]);

  const setRefreshFunction = useCallback((refreshFn: () => Promise<void>) => {
    refreshRef.current = refreshFn;
    logRefreshOperation('Refresh function registered', { 
      merchantPubkey: safePublicKeyToString(merchantPubkey)
    });
  }, [logRefreshOperation, merchantPubkey]);

  return {
    forceRefresh,
    setRefreshFunction,
  };
} 