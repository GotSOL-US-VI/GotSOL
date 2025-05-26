import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { env } from '@/utils/env';
import { checkWalletBalance } from '@/lib/para-server';

// Initialize connection to Solana network
const connection = new Connection(
  env.isDevnet ? env.devnetHeliusRpcUrl : env.mainnetHeliusRpcUrl,
  'confirmed'
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { serializedTransaction, publicKey } = req.body;

    if (!serializedTransaction || !publicKey) {
      return res.status(400).json({ error: 'Missing serializedTransaction or publicKey in request body' });
    }

    // Check if user has sufficient balance
    const hasBalance = await checkWalletBalance(new PublicKey(publicKey));
    if (!hasBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
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

    // Send the transaction (it should already be signed by the client)
    const signature = await connection.sendRawTransaction(
      transactionBuffer,
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