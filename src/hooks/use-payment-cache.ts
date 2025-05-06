'use client';

import { useEffect, useCallback } from 'react';
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
        const parsedData = JSON.parse(cachedData) as SerializedPayment[];
        
        // Convert serialized PublicKey back to PublicKey objects
        const payments = parsedData.map((payment: SerializedPayment) => ({
          ...payment,
          sender: new PublicKey(payment.sender)
        }));
        
        // Set the payments in React Query cache
        queryClient.setQueryData(['payments', merchantPubkey?.toString(), isDevnet], payments);
      }
    } catch (error) {
      console.error('Error loading cached payments:', error);
    }
  }, [cacheKey, queryClient, merchantPubkey, isDevnet]);
  
  // Save payments to localStorage when data changes
  const savePaymentsToCache = useCallback((payments: Payment[]): void => {
    if (!cacheKey) return;
    
    try {
      // Prepare data for serialization (convert PublicKey to string)
      const serializedData: SerializedPayment[] = payments.map(payment => ({
        ...payment,
        sender: payment.sender.toString()
      }));
      
      localStorage.setItem(cacheKey, JSON.stringify(serializedData));
    } catch (error) {
      console.error('Error saving payments to cache:', error);
    }
  }, [cacheKey]);
  
  return { savePaymentsToCache };
} 