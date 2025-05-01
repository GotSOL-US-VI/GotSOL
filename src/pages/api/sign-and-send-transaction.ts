import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { env } from '@/utils/env';
import { signTransactionWithFeePayer, checkFeePayerBalance } from '@/lib/para-server';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transaction } = req.body;

    if (!transaction) {
      return res.status(400).json({ error: 'Transaction is required' });
    }

    // Check if fee payer has sufficient balance
    const hasBalance = await checkFeePayerBalance();
    if (!hasBalance) {
      return res.status(400).json({ error: 'Fee payer has insufficient balance' });
    }

    // Convert the transaction to a Buffer
    const transactionBuffer = Buffer.from(transaction, 'base64');

    // Sign the transaction with the fee payer
    const signedTransaction = await signTransactionWithFeePayer(transactionBuffer);

    // Initialize connection
    const connection = new Connection(
      env.isDevnet ? env.devnetHeliusRpcUrl : env.mainnetHeliusRpcUrl,
      'confirmed'
    );

    // Send the transaction
    const signature = await connection.sendRawTransaction(signedTransaction, {
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