import { Transaction, PublicKey } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";

/**
 * Executes a transaction using the owner's signer
 * @param program The program to execute
 * @param methodBuilder The method builder to use
 * @param accounts The accounts to use
 * @param signer The Para signer to use for signing the transaction
 * @returns The transaction signature
 */
export async function executeTransaction(
  program: Program<Idl>,
  methodBuilder: any,
  accounts: any,
  signer: ParaSolanaWeb3Signer
): Promise<string> {
  try {
    // Log the program ID for debugging
    console.log('Program ID:', program.programId.toString());
    
    // Log the accounts for debugging
    console.log('Accounts for transaction:', accounts);
    
    // Get the owner's public key from the accounts
    const ownerPubkey = accounts.owner;
    if (!ownerPubkey) {
      throw new Error('Owner public key not found in accounts');
    }
    
    if (!signer) {
      throw new Error('Signer not provided');
    }
    
    // Build the transaction
    const tx = await methodBuilder
      .accounts(accounts)
      .transaction();

    // Get the latest blockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = ownerPubkey;

    // Sign the transaction with the owner using the Para signer
    console.log('Signing transaction with owner key:', ownerPubkey.toString());
    const signedTx = await signer.signTransaction(tx);
    
    // Send the signed transaction
    const connection = program.provider.connection;
    console.log('Sending signed transaction to the network');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    console.log('Waiting for transaction confirmation');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    console.log('Transaction confirmed successfully:', signature);
    return signature;
  } catch (error) {
    console.error('Error executing transaction:', error);
    throw error;
  }
} 