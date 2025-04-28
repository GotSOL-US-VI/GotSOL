import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Transaction, Keypair } from '@solana/web3.js';

// Initialize connection to Solana network (use your RPC URL)
const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL || '');

// Initialize fee payer keypair from environment variable
const feePayerPrivateKey = process.env.FEE_PAYER_PRIVATE_KEY;
if (!feePayerPrivateKey) {
  throw new Error('FEE_PAYER_PRIVATE_KEY environment variable is not set');
}

const feePayerKeypair = Keypair.fromSecretKey(
  new Uint8Array(feePayerPrivateKey.split(',').map(num => parseInt(num)))
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { serializedTransaction } = req.body;

    if (!serializedTransaction) {
      return res.status(400).json({ error: 'Missing serializedTransaction in request body' });
    }

    // Convert base64 string to buffer
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');

    // Deserialize the transaction
    const transaction = Transaction.from(transactionBuffer);

    // Sign the transaction with the fee payer
    transaction.sign(feePayerKeypair);

    // Send the signed transaction
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      }
    );

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    // Return the signature
    return res.status(200).json({ signature });
  } catch (error) {
    console.error('Error processing transaction:', error);
    return res.status(500).json({ error: error.message });
  }
} 