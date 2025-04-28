import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Load the fee payer keypair
let feePayerKeypair: Keypair | null = null;
try {
  const keypairPath = path.resolve(process.cwd(), 'fee-payer-keypair.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const secretKey = new Uint8Array(keypairData);
  feePayerKeypair = Keypair.fromSecretKey(secretKey);
  console.log('Loaded fee payer keypair with public key:', feePayerKeypair.publicKey.toString());
} catch (error) {
  console.error('Failed to load fee payer keypair:', error);
}

export async function signTransaction(
  serializedTx: string,
  feePayer: PublicKey
): Promise<string> {
  try {
    // Log the serialized transaction for debugging
    console.log('Serialized transaction:', serializedTx);

    // Log the fee payer for debugging
    console.log('Fee payer:', feePayer.toString());

    // Deserialize the transaction
    const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));

    // Log the transaction for debugging
    console.log('Transaction:', {
      recentBlockhash: transaction.recentBlockhash,
      feePayer: transaction.feePayer?.toString() || 'undefined',
      instructions: transaction.instructions.length,
      signers: transaction.signatures.length
    });

    // Check if the transaction is valid
    if (!transaction) {
      throw new Error('Transaction is undefined');
    }

    // Check if the recent blockhash is valid
    if (!transaction.recentBlockhash) {
      throw new Error('Recent blockhash is undefined');
    }

    // Check if the fee payer is valid
    if (!transaction.feePayer) {
      throw new Error('Fee payer is undefined');
    }

    // Check if the instructions are valid
    if (!transaction.instructions || transaction.instructions.length === 0) {
      throw new Error('Transaction has no instructions');
    }

    // Set the fee payer
    transaction.feePayer = feePayer;

    // Sign the transaction with the fee payer keypair if available
    if (feePayerKeypair) {
      console.log('Signing transaction with fee payer keypair');
      transaction.sign(feePayerKeypair);
      
      // Log the signed transaction for debugging
      console.log('Signed transaction:', transaction);

      // Serialize the signed transaction
      const serializedSignedTx = transaction.serialize().toString('base64');

      // Log the serialized signed transaction for debugging
      console.log('Serialized signed transaction:', serializedSignedTx);

      return serializedSignedTx;
    } else {
      throw new Error('Fee payer keypair not available. Cannot sign transaction.');
    }
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
} 