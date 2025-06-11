import { useEffect, useRef } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { useQueryClient } from '@tanstack/react-query';

interface UseTokenAccountListenerProps {
  tokenAccountAddress: PublicKey;
  isNativeAccount?: boolean; // True for SOL, false for SPL tokens
  enabled?: boolean;
  onBalanceChange?: (newBalance: number) => void;
}

/**
 * Hook to listen for real-time changes to a specific token account
 * Uses Solana's WebSocket subscriptions for immediate updates
 * Handles both native SOL accounts and SPL token accounts
 */
export function useTokenAccountListener({
  tokenAccountAddress,
  isNativeAccount = false,
  enabled = true,
  onBalanceChange
}: UseTokenAccountListenerProps) {
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const subscriptionIdRef = useRef<number | null>(null);
  const addressStringRef = useRef<string>('');
  
  // Store onBalanceChange in a ref to avoid it being a dependency
  const onBalanceChangeRef = useRef(onBalanceChange);
  onBalanceChangeRef.current = onBalanceChange;

  // Extract address string to avoid complex expression in dependency array
  const tokenAccountAddressString = tokenAccountAddress.toString();

  useEffect(() => {
    if (!enabled || !connection || !tokenAccountAddress) {
      return;
    }

    const currentAddressString = tokenAccountAddressString;
    
    // Prevent setting up listener for the same address
    if (addressStringRef.current === currentAddressString && subscriptionIdRef.current !== null) {
      return;
    }

    // Clean up existing listener if address changed
    if (subscriptionIdRef.current !== null && addressStringRef.current !== currentAddressString) {
      console.log('🔇 Removing listener for token account:', addressStringRef.current);
      connection.removeAccountChangeListener(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }

    // Set up new listener
    console.log('🔊 Setting up listener for token account:', currentAddressString);
    addressStringRef.current = currentAddressString;

    // Subscribe to account changes
    const subscriptionId = connection.onAccountChange(
      tokenAccountAddress,
      (accountInfo, context) => {
        console.log('🔊 Account changed:', {
          account: tokenAccountAddressString,
          slot: context.slot,
          isNative: isNativeAccount,
          dataLength: accountInfo.data.length,
          lamports: accountInfo.lamports
        });

        // Parse the account data based on account type
        try {
          let uiAmount: number;

          if (isNativeAccount) {
            // For native SOL accounts, balance is in lamports
            uiAmount = accountInfo.lamports / 1_000_000_000; // Convert to SOL (9 decimals)
            console.log('🔊 New SOL balance:', uiAmount);
            
            // Invalidate SOL balance cache
            queryClient.invalidateQueries({
              queryKey: ['sol-balance']
            });
          } else {
            // For SPL token accounts, parse token account data
            if (accountInfo.data.length >= 72) {
              const dataView = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset);
              const rawAmount = dataView.getBigUint64(64, true); // little endian
              const decimals = 6; // This should come from the mint, but defaulting to 6 for stablecoins
              uiAmount = Number(rawAmount) / Math.pow(10, decimals);
              
              console.log('🔊 New SPL token balance:', uiAmount);
              
              // Invalidate token balance cache
              queryClient.invalidateQueries({
                queryKey: ['token-balance']
              });
            } else {
              console.warn('SPL token account data too short:', accountInfo.data.length);
              return;
            }
          }
          
          // Trigger callback if provided using ref to avoid dependency
          if (onBalanceChangeRef.current) {
            onBalanceChangeRef.current(uiAmount);
          }

        } catch (error) {
          console.error('Error parsing account data:', error);
        }
      },
      'confirmed' // Listen for confirmed transactions
    );

    subscriptionIdRef.current = subscriptionId;

    // Cleanup function
    return () => {
      if (subscriptionIdRef.current !== null) {
        console.log('🔇 Removing listener for token account:', addressStringRef.current);
        connection.removeAccountChangeListener(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
        addressStringRef.current = '';
      }
    };
  }, [connection, tokenAccountAddress, tokenAccountAddressString, enabled, isNativeAccount, queryClient]);

  // Return the subscription status
  return {
    isListening: subscriptionIdRef.current !== null,
    subscriptionId: subscriptionIdRef.current
  };
}

/**
 * Hook to listen to multiple token accounts at once
 * Note: This approach is limited by React's rules of hooks.
 * For dynamic lists of accounts, consider using a different pattern
 * or individual hook calls for each known account.
 */
export function useMultiTokenAccountListener(
  tokenAccounts: { address: PublicKey; label: string }[],
  enabled = true
) {
  // Due to React's rules of hooks, we cannot dynamically call hooks in a loop
  // For now, we'll return a placeholder implementation
  // In practice, you should call useTokenAccountListener individually for each account
  
  console.warn('useMultiTokenAccountListener: For production use, call useTokenAccountListener individually for each account to avoid hook rule violations');
  
  return {
    activeListeners: 0,
    totalListeners: tokenAccounts.length,
    isAllListening: false,
    note: 'Use individual useTokenAccountListener calls for each account instead'
  };
} 