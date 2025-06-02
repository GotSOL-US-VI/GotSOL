import { PublicKey } from '@solana/web3.js';

/**
 * Safely convert a PublicKey to string, preventing infinite recursion
 * @param publicKey The PublicKey to convert
 * @returns Base58 string representation or error placeholder
 */
export function safePublicKeyToString(publicKey: PublicKey | null | undefined): string {
  if (!publicKey) return 'null';
  
  try {
    // Use toBase58() instead of toString() to avoid potential circular references
    return publicKey.toBase58();
  } catch (error) {
    console.warn('Error converting PublicKey to string:', error);
    return '[PublicKey:Error]';
  }
}

/**
 * Safely format a PublicKey for display (showing first and last 4 characters)
 * @param publicKey The PublicKey to format
 * @returns Formatted string like "1234...5678"
 */
export function safeFormatPublicKey(publicKey: PublicKey | null | undefined): string {
  const keyString = safePublicKeyToString(publicKey);
  if (keyString === 'null' || keyString === '[PublicKey:Error]') {
    return keyString;
  }
  
  return `${keyString.slice(0, 4)}...${keyString.slice(-4)}`;
}

/**
 * Safe JSON serializer that handles PublicKey objects
 * @param obj Object to serialize
 * @returns JSON string with PublicKey objects converted to strings
 */
export function safeJsonStringify(obj: any): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Handle PublicKey objects specifically
      if (value && typeof value === 'object' && value.constructor) {
        if (value.constructor.name === 'PublicKey') {
          return safePublicKeyToString(value);
        }
        // Handle other potential circular references
        if (typeof value === 'object' && value !== null) {
          // Check for circular references by limiting depth
          try {
            JSON.stringify(value);
            return value;
          } catch {
            return Object.prototype.toString.call(value);
          }
        }
      }
      return value;
    });
  } catch (error) {
    return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
  }
} 