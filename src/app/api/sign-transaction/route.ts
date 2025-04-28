import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Connection, Transaction } from '@solana/web3.js';
import { deserializeTransaction } from '@/utils/transaction-serializer';
import { promisify } from 'util';
import { exec } from 'child_process';
import bs58 from 'bs58';

// Promisify exec for easier async/await usage
const execAsync = promisify(exec);

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

export async function POST(request: NextRequest) {
  try {
    const { serializedTx } = await request.json();
    
    if (!serializedTx) {
      return NextResponse.json({ error: 'Missing serialized transaction' }, { status: 400 });
    }
    
    // Get the fee payer private key from environment variables
    const feePayerPrivateKey = process.env.FEE_PAYER_PRIVATE_KEY;
    if (!feePayerPrivateKey) {
      return NextResponse.json({ error: 'Fee payer private key not configured' }, { status: 500 });
    }
    
    // Log the format of the private key (without exposing the actual key)
    console.log('Private key format:', {
      length: feePayerPrivateKey.length,
      isBase58: /^[1-9A-HJ-NP-Za-km-z]+$/.test(feePayerPrivateKey),
      isCommaSeparated: /^[\d,\s]+$/.test(feePayerPrivateKey),
      isJsonArray: feePayerPrivateKey.startsWith('[') && feePayerPrivateKey.endsWith(']'),
      hasQuotes: feePayerPrivateKey.startsWith("'") || feePayerPrivateKey.startsWith('"'),
      firstFewChars: feePayerPrivateKey.substring(0, 5) + '...'
    });
    
    // Clean up the private key - remove quotes if present
    let cleanedPrivateKey = feePayerPrivateKey;
    if (cleanedPrivateKey.startsWith("'") && cleanedPrivateKey.endsWith("'")) {
      cleanedPrivateKey = cleanedPrivateKey.substring(1, cleanedPrivateKey.length - 1);
    } else if (cleanedPrivateKey.startsWith('"') && cleanedPrivateKey.endsWith('"')) {
      cleanedPrivateKey = cleanedPrivateKey.substring(1, cleanedPrivateKey.length - 1);
    }
    
    // Log the serialized transaction for debugging
    console.log('Received serialized transaction:', serializedTx.substring(0, 50) + '...');
    
    // Deserialize the transaction - this will preserve any existing signatures
    let transaction: Transaction;
    try {
      // Try to decode the base64 string
      const txBuffer = Buffer.from(serializedTx, 'base64');
      console.log('Transaction buffer length:', txBuffer.length);
      
      // Create the transaction from the buffer
      transaction = Transaction.from(txBuffer);
      console.log('Transaction deserialized successfully');
      
      // Log transaction details
      console.log('Deserialized transaction:', {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toString() || 'undefined',
        instructions: transaction.instructions.length,
        signers: transaction.signatures.length
      });
      
      // Log each instruction's program ID and account keys
      transaction.instructions.forEach((instruction, index) => {
        console.log(`Instruction ${index}:`, {
          programId: instruction.programId.toString(),
          keys: instruction.keys.map(key => key.pubkey.toString())
        });
      });
    } catch (deserializationError) {
      console.error('Error deserializing transaction:', deserializationError);
      return NextResponse.json({ error: 'Invalid transaction format' }, { status: 400 });
    }
    
    // Create the fee payer keypair
    let feePayerKeypair: Keypair;
    try {
      // Try different formats for the private key
      let privateKeyBytes: Uint8Array;
      
      // First, try to parse as a comma-separated list of numbers
      try {
        privateKeyBytes = new Uint8Array(cleanedPrivateKey.split(',').map(num => parseInt(num)));
        feePayerKeypair = Keypair.fromSecretKey(privateKeyBytes);
        console.log('Created fee payer keypair from comma-separated list');
      } catch (e) {
        console.log('Failed to parse as comma-separated list, trying base58...');
        
        // Then, try to parse as a base58 string
        try {
          privateKeyBytes = bs58.decode(cleanedPrivateKey);
          feePayerKeypair = Keypair.fromSecretKey(privateKeyBytes);
          console.log('Created fee payer keypair from base58 string');
        } catch (e) {
          console.log('Failed to parse as base58, trying JSON array...');
          
          // Finally, try to parse as a JSON array
          try {
            const jsonArray = JSON.parse(cleanedPrivateKey);
            privateKeyBytes = new Uint8Array(jsonArray);
            feePayerKeypair = Keypair.fromSecretKey(privateKeyBytes);
            console.log('Created fee payer keypair from JSON array');
          } catch (e) {
            throw new Error('Could not parse private key in any format');
          }
        }
      }
      
      console.log('Created fee payer keypair with public key:', feePayerKeypair.publicKey.toString());
    } catch (keypairError) {
      console.error('Error creating fee payer keypair:', keypairError);
      return NextResponse.json({ 
        error: 'Invalid fee payer private key format',
        details: keypairError instanceof Error ? keypairError.message : String(keypairError)
      }, { status: 500 });
    }
    
    // Set the fee payer
    transaction.feePayer = feePayerKeypair.publicKey;
    
    // Log transaction details for debugging
    console.log('Transaction before signing:', {
      recentBlockhash: transaction.recentBlockhash,
      feePayer: transaction.feePayer.toString(),
      instructions: transaction.instructions.length,
      signers: transaction.signatures.length
    });
    
    // Sign the transaction with the fee payer
    transaction.partialSign(feePayerKeypair);
    
    // Verify the signature was added
    const feePayerSignature = transaction.signatures.find(
      sig => sig.publicKey.equals(feePayerKeypair.publicKey)
    );
    
    if (!feePayerSignature || !feePayerSignature.signature) {
      throw new Error('Failed to add fee payer signature to transaction');
    }
    
    console.log('Fee payer signature added successfully');
    
    // Log transaction details after signing
    console.log('Transaction after signing:', {
      recentBlockhash: transaction.recentBlockhash,
      feePayer: transaction.feePayer.toString(),
      instructions: transaction.instructions.length,
      signers: transaction.signatures.length,
      feePayerSignaturePresent: !!feePayerSignature.signature
    });
    
    // Serialize the transaction
    const signedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    
    // Return the signed transaction instead of sending it
    return NextResponse.json({ 
      signedTx: Buffer.from(signedTx).toString('base64'),
      feePayer: feePayerKeypair.publicKey.toString()
    });
  } catch (error) {
    console.error('Error signing transaction:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to sign transaction';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    }
    
    // Log the full error details
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorDetails,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
} 