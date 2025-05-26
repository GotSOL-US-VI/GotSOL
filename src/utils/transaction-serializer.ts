import { Transaction, PublicKey } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';

/**
 * Serializes a transaction
 * @param program The Anchor program
 * @param methodBuilder The method builder from the program
 * @param accounts The accounts for the transaction
 * @param feePayer The public key of the fee payer (owner)
 * @returns The serialized transaction as a base64 string
 */
export async function serializeTransaction(
  program: Program<Idl>,
  methodBuilder: any,
  accounts: any,
  feePayer: PublicKey
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
    
    // Set the fee payer
    tx.feePayer = feePayer;
    console.log('Using fee payer:', feePayer.toString());
    
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
 * Serializes an existing transaction
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
    console.error('Error serializing transaction:', error);
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