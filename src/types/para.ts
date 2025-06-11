import type { useClient } from '@getpara/react-sdk';

// Use the return type of useClient instead of importing Para directly
type ParaClient = NonNullable<ReturnType<typeof useClient>>;

// Type guard to safely check if Para instance has the required methods
export function isParaCompatible(para: ParaClient): para is ParaClient & { core?: any } {
  return para && typeof para === 'object' && 'getWallets' in para;
}

// More specific type assertion for ParaSolanaWeb3Signer compatibility
export function toParaSignerCompatible(para: ParaClient): any {
  if (!para) {
    throw new Error('Para client is not available');
  }
  
  if (!isParaCompatible(para)) {
    throw new Error('Invalid Para instance provided');
  }
  
  // Return the Para instance with type assertion to bypass complex Para SDK internal types
  // This follows the same pattern used in withdraw-funds.tsx and other working components
  return para as any;
}

// Export the type for use in components
export type ParaSignerCompatible = ReturnType<typeof toParaSignerCompatible>; 