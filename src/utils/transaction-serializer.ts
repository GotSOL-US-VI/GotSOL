import { Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';

// Use the specific fee payer public key provided by the user
const FEE_PAYER_PUBKEY = new PublicKey('3vexG5TyQvyscvZzPHSPyYvszUyuL2gY76sZEsGc9B9i');

// Instead of loading from file system, we'll use environment variables or other browser-compatible methods
// to get the fee payer keypair
let feePayerKeypair: Keypair | null = null;

// We'll initialize this in a browser-compatible way
try {
  // For development/testing, you might use a hardcoded keypair
  // For production, use a more secure method like environment variables or a secure key management service
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY) {
    const privateKeyString = process.env.NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY;
    const privateKeyBytes = new Uint8Array(privateKeyString.split(',').map(num => parseInt(num)));
    feePayerKeypair = Keypair.fromSecretKey(privateKeyBytes);
    console.log('Loaded fee payer keypair with public key:', feePayerKeypair.publicKey.toString());
  }
} catch (error) {
  console.error('Failed to load fee payer keypair:', error);
}

/**
 * Serializes a transaction to be signed by a fee payer
 * @param program The Anchor program
 * @param methodBuilder The method builder from the program
 * @param accounts The accounts for the transaction
 * @returns The serialized transaction as a base64 string
 */
export async function serializeTransaction(
  program: Program<Idl>,
  methodBuilder: any,
  accounts: any
): Promise<string> {
  try {
    // Build the transaction without sending it
    const tx = await methodBuilder
      .accountsPartial(accounts)
      .transaction();
    
    // Get the latest blockhash from the connection
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    
    // Set the recent blockhash on the transaction
    tx.recentBlockhash = blockhash;
    
    // Use the specific fee payer public key
    tx.feePayer = FEE_PAYER_PUBKEY;
    console.log('Using fee payer:', FEE_PAYER_PUBKEY.toString());
    
    // Serialize the transaction to base64
    const serializedBytes = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    // Convert to base64 string using browser-compatible approach
    let binary = '';
    const bytes = new Uint8Array(serializedBytes);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error serializing transaction:', error);
    throw error;
  }
}

/**
 * Serializes an existing transaction to be signed by a fee payer
 * @param transaction The transaction to serialize
 * @returns The serialized transaction as a base64 string
 */
export function serializeExistingTransaction(transaction: Transaction): string {
  try {
    // Ensure the transaction has a recent blockhash
    if (!transaction.recentBlockhash) {
      throw new Error('Transaction missing recentBlockhash');
    }
    
    // Ensure the transaction has a fee payer
    if (!transaction.feePayer) {
      throw new Error('Transaction missing feePayer');
    }
    
    // Log transaction details for debugging
    console.log('Serializing transaction:', {
      recentBlockhash: transaction.recentBlockhash,
      feePayer: transaction.feePayer?.toString() || 'undefined',
      instructions: transaction.instructions.length,
      signers: transaction.signatures.length
    });
    
    // Log each instruction's program ID and account keys for debugging
    transaction.instructions.forEach((instruction, index) => {
      console.log(`Instruction ${index} details:`, {
        programId: instruction.programId?.toString() || 'undefined',
        keys: instruction.keys.map(key => key.pubkey?.toString() || 'undefined')
      });
      
      // Log detailed information about each account key
      instruction.keys.forEach((key, keyIndex) => {
        try {
          console.log(`Instruction ${index}, Key ${keyIndex}:`, {
            pubkey: key.pubkey?.toString() || 'undefined',
            isSigner: key.isSigner,
            isWritable: key.isWritable
          });
        } catch (err) {
          console.error(`Error logging key ${keyIndex} for instruction ${index}:`, err);
        }
      });
    });
    
    // Serialize the transaction to base64
    const serializedBytes = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    // Convert to base64 string using browser-compatible approach
    let binary = '';
    const bytes = new Uint8Array(serializedBytes);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error serializing existing transaction:', error);
    throw error;
  }
}

/**
 * Deserializes a transaction from a base64 string
 * @param serializedTx The serialized transaction as a base64 string
 * @returns The deserialized transaction
 */
export function deserializeTransaction(serializedTx: string): Transaction {
  try {
    // Convert the base64 string to a buffer
    // Use a browser-compatible approach
    const binaryString = atob(serializedTx);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Deserialize the transaction
    const transaction = Transaction.from(bytes);
    
    // Log transaction details for debugging
    console.log('Deserialized transaction:', {
      recentBlockhash: transaction.recentBlockhash,
      feePayer: transaction.feePayer?.toString() || 'undefined',
      instructions: transaction.instructions.length,
      signers: transaction.signatures.length
    });
    
    // Log each instruction's program ID and account keys for debugging
    transaction.instructions.forEach((instruction, index) => {
      console.log(`Instruction ${index} details:`, {
        programId: instruction.programId?.toString() || 'undefined',
        keys: instruction.keys.map(key => key.pubkey?.toString() || 'undefined')
      });
    });
    
    return transaction;
  } catch (error) {
    console.error('Error deserializing transaction:', error);
    throw error;
  }
} 