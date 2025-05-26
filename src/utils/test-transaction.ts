import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import { executeTransaction } from './execute-transaction';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";

// This is a test function to verify the transaction signing flow
export async function testTransactionSigning(
  program: Program<Idl>,
  ownerPubkey: PublicKey,
  signer: ParaSolanaWeb3Signer
) {
  try {
    console.log('Starting transaction signing test...');
    
    if (!ownerPubkey || !signer) {
      throw new Error('Owner public key or signer not provided');
    }
    
    console.log('Owner public key:', ownerPubkey.toString());
    
    // Create a simple transaction to test with
    const connection = program.provider.connection;
    const { blockhash } = await connection.getLatestBlockhash();
    
    // Create a simple transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: ownerPubkey,
      toPubkey: ownerPubkey, // Transfer to self for testing
      lamports: 1000, // Small amount for testing
    });
    
    // Create a transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerPubkey;
    transaction.add(transferInstruction);
    
    // Create a method builder that will use our transaction
    const methodBuilder = {
      transaction: async () => transaction,
      accounts: (accounts: any) => {
        console.log('Accounts provided to method builder:', accounts);
        return methodBuilder;
      }
    };
    
    // Create the accounts object
    const accounts = {
      owner: ownerPubkey,
    };
    
    console.log('Executing transaction...');
    
    // Execute the transaction
    const signature = await executeTransaction(program, methodBuilder, accounts, signer);
    
    console.log('Transaction executed successfully!');
    console.log('Signature:', signature);
    
    return signature;
  } catch (error) {
    console.error('Error testing transaction signing:', error);
    throw error;
  }
} 