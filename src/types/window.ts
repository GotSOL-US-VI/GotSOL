import { Connection, PublicKey, Transaction } from '@solana/web3.js';

export interface WindowWithSolana {
  solana: {
    connection: Connection;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  };
} 