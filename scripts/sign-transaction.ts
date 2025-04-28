import { Keypair, Connection, Transaction } from '@solana/web3.js';
import { deserializeTransaction } from '../src/utils/transaction-serializer';
import * as fs from 'fs';
import * as path from 'path';

// Get the private key from the .env file
const PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('FEE_PAYER_PRIVATE_KEY not found in environment variables');
  process.exit(1);
}

// Parse the private key
const privateKeyBytes = Buffer.from(JSON.parse(PRIVATE_KEY));
const feePayer = Keypair.fromSecretKey(privateKeyBytes);

// Get the RPC URL from the .env file -- devnet for now
const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
if (!RPC_URL) {
  console.error('NEXT_PUBLIC_HELIUS_RPC_URL not found in environment variables');
  process.exit(1);
}

// Create a connection
const connection = new Connection(RPC_URL);

// Get the serialized transaction from the command line arguments
const serializedTx = process.argv[2];
if (!serializedTx) {
  console.error('No serialized transaction provided');
  process.exit(1);
}

// Retry configuration
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds

// Helper function to wait for a specified time
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to determine if an error is retryable
const isRetryableError = (error: any): boolean => {
  const errorMessage = error.message || '';
  
  // Common retryable errors
  const retryableErrors = [
    'Too many requests',
    'rate limit',
    '429',
    'timeout',
    'network error',
    'connection reset',
    'failed to fetch',
    'nonce too old',
    'blockhash not found',
    'blockhash expired',
  ];
  
  return retryableErrors.some(retryableError => 
    errorMessage.toLowerCase().includes(retryableError.toLowerCase())
  );
};

async function main() {
  try {
    // Deserialize the transaction
    const transaction = deserializeTransaction(serializedTx);
    
    // Sign the transaction with the fee payer
    transaction.sign(feePayer);
    
    // Send the transaction with retry logic
    let signature: string | undefined;
    let lastError: any;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Calculate exponential backoff delay
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
        
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay...`);
          await sleep(delay);
        }
        
        // Send the transaction
        signature = await connection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: false }
        );
        
        // If we get here, the transaction was sent successfully
        break;
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        
        // Check if the error is retryable
        if (!isRetryableError(error) || attempt === MAX_RETRIES - 1) {
          throw error; // Don't retry if it's not a retryable error or we've reached max retries
        }
      }
    }
    
    if (!signature) {
      throw lastError || new Error('Failed to send transaction after multiple attempts');
    }
    
    // Wait for confirmation with retry logic
    let confirmation;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
        
        if (attempt > 0) {
          console.log(`Confirmation retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay...`);
          await sleep(delay);
        }
        
        confirmation = await connection.confirmTransaction(signature);
        break;
      } catch (error: any) {
        lastError = error;
        console.error(`Confirmation attempt ${attempt + 1} failed:`, error.message);
        
        if (!isRetryableError(error) || attempt === MAX_RETRIES - 1) {
          throw error;
        }
      }
    }
    
    if (!confirmation) {
      throw lastError || new Error('Failed to confirm transaction after multiple attempts');
    }
    
    console.log('Transaction sent:', signature);
    console.log('Confirmation status:', confirmation.value.err ? 'failed' : 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
    }
  } catch (error) {
    console.error('Error signing and sending transaction:', error);
    process.exit(1); // Exit with error code to indicate failure
  }
}

main(); 