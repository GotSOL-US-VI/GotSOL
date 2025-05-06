import { Environment, ParaWeb } from "@getpara/react-sdk";
import { Connection } from "@solana/web3.js";

const apiKey = process.env.NEXT_PUBLIC_PARA_API_KEY;

// Cache for frequently accessed data
const cache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Connection health check
export const checkConnectionHealth = async (connection: Connection) => {
  try {
    // Use getVersion as a health check
    await connection.getVersion();
    return true;
  } catch (error) {
    console.error('Connection health check failed:', error);
    return false;
  }
};

// Retry with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * baseDelay));
    }
  }
  throw new Error('Max retries exceeded');
};

// Debug API key (only show first 4 and last 4 characters for security)
// console.log("Para API Key being used:", apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "Not set");

// Create a dummy Para instance for static page generation
const dummyPara = new ParaWeb(Environment.BETA, "dummy-key");

// Initialize the actual Para instance with enhanced error handling
export const para = apiKey
    ? new ParaWeb(Environment.BETA, apiKey)
    : dummyPara;

// Enhanced data fetching with caching
export const getCachedData = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl = CACHE_TTL
): Promise<T> => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Transaction confirmation helper
export const confirmTransaction = async (
  connection: Connection,
  signature: string,
  commitment: 'confirmed' | 'finalized' = 'confirmed'
) => {
  const confirmation = await connection.confirmTransaction(signature, commitment);
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }
  return confirmation;
};

// Note: Event handling is managed through the ParaProvider component
// using the appropriate SDK methods
