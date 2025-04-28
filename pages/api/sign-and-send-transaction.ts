import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Transaction, Keypair } from '@solana/web3.js';

// Initialize connection to Solana network (use your RPC URL)
const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL || '');

// Initialize fee payer keypair from environment variable
const feePayerPrivateKey = process.env.FEE_PAYER_PRIVATE_KEY;
if (!feePayerPrivateKey) {
  console.warn('FEE_PAYER_PRIVATE_KEY environment variable is not set');
}

// Only initialize the keypair if we have the private key
const feePayerKeypair = feePayerPrivateKey ? 
  Keypair.fromSecretKey(
    new Uint8Array(feePayerPrivateKey.split(',').map(num => parseInt(num)))
  ) : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if fee payer is configured
    if (!feePayerKeypair) {
      return res.status(500).json({ error: 'Fee payer not configured' });
    }

    const { serializedTransaction } = req.body;

    if (!serializedTransaction) {
      return res.status(400).json({ error: 'Missing serializedTransaction in request body' });
    }

    console.log('Received serialized transaction:', serializedTransaction);

    // Convert base64 string to buffer
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');

    // Deserialize the transaction
    const transaction = Transaction.from(transactionBuffer);

    console.log('Deserialized transaction:', {
      feePayer: transaction.feePayer?.toString(),
      recentBlockhash: transaction.recentBlockhash,
      instructions: transaction.instructions.length
    });

    // Sign the transaction with the fee payer
    transaction.partialSign(feePayerKeypair);

    console.log('Transaction signed by fee payer');

    // Send the signed transaction
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      }
    );

    console.log('Transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    console.log('Transaction confirmation:', confirmation);

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    // Return the signature
    return res.status(200).json({ signature });
  } catch (error: any) {
    console.error('Error processing transaction:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
} 