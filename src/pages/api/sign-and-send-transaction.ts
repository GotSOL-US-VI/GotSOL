import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { env } from '@/utils/env';
import { checkWalletBalance } from '@/lib/para-server';
import { PublicKey } from '@solana/web3.js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transaction, publicKey } = req.body;

    if (!transaction || !publicKey) {
      return res.status(400).json({ error: 'Transaction and public key are required' });
    }

    // Check if user has sufficient balance
    const hasBalance = await checkWalletBalance(new PublicKey(publicKey));
    if (!hasBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Convert the transaction to a Buffer
    const transactionBuffer = Buffer.from(transaction, 'base64');

    // Initialize connection
    const connection = new Connection(
      env.isDevnet ? env.devnetHeliusRpcUrl : env.mainnetHeliusRpcUrl,
      'confirmed'
    );

    // Send the transaction (it should already be signed by the client)
    const signature = await connection.sendRawTransaction(transactionBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return res.status(200).json({
      signature,
      confirmation,
    });
  } catch (error) {
    console.error('Error in sign-and-send-transaction:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    });
  }
} 