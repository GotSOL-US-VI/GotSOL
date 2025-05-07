import { Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";

// Use the specific fee payer public key provided by the user
const FEE_PAYER_PUBKEY = new PublicKey('3vexG5TyQvyscvZzPHSPyYvszUyuL2gY76sZEsGc9B9i');

// Instead of loading from file system, we'll use environment variables or other browser-compatible methods
// to get the fee payer keypair
let feePayerKeypair: Keypair | null = null;

// We'll initialize this in a browser-compatible way
// This is a placeholder - you'll need to implement a secure way to get the keypair in your app
try {
  // For development/testing, you might use a hardcoded keypair
  // For production, use a more secure method like environment variables or a secure key management service
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY) {
    const privateKeyString = process.env.NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY;
    
    // Clean up the private key - remove quotes if present
    let cleanedPrivateKey = privateKeyString;
    if (cleanedPrivateKey.startsWith("'") && cleanedPrivateKey.endsWith("'")) {
      cleanedPrivateKey = cleanedPrivateKey.substring(1, cleanedPrivateKey.length - 1);
    } else if (cleanedPrivateKey.startsWith('"') && cleanedPrivateKey.endsWith('"')) {
      cleanedPrivateKey = cleanedPrivateKey.substring(1, cleanedPrivateKey.length - 1);
    }
    
    // Try different formats for the private key
    let privateKeyBytes: Uint8Array;
    
    // First, try to parse as a comma-separated list of numbers
    try {
      privateKeyBytes = new Uint8Array(cleanedPrivateKey.split(',').map(num => parseInt(num)));
      feePayerKeypair = Keypair.fromSecretKey(privateKeyBytes);
      console.log('Loaded fee payer keypair from comma-separated list');
    } catch (e) {
      console.log('Failed to parse as comma-separated list, trying JSON array...');
      
      // Try to parse as a JSON array
      try {
        const jsonArray = JSON.parse(cleanedPrivateKey);
        privateKeyBytes = new Uint8Array(jsonArray);
        feePayerKeypair = Keypair.fromSecretKey(privateKeyBytes);
        console.log('Loaded fee payer keypair from JSON array');
      } catch (e) {
        console.error('Could not parse private key in any format');
        // Don't throw, just log the error and continue
      }
    }
    
    if (feePayerKeypair) {
      console.log('Loaded fee payer keypair with public key:', feePayerKeypair.publicKey.toString());
    }
  }
} catch (error) {
  console.error('Failed to load fee payer keypair:', error);
}

/**
 * Validates and sanitizes account keys to ensure they are valid PublicKey objects
 * @param accounts The accounts object to validate
 * @returns A sanitized copy of the accounts object
 */
function sanitizeAccounts(accounts: any): any {
  const sanitizedAccounts: any = {};
  
  for (const [key, value] of Object.entries(accounts)) {
    if (value instanceof PublicKey) {
      // For PublicKey objects, keep them as is without conversion
      sanitizedAccounts[key] = value;
    } else if (typeof value === 'string' && value.length > 0) {
      // Try to convert string to PublicKey if it looks like one
      try {
        // Check if the string is a valid base58 string
        if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
          sanitizedAccounts[key] = new PublicKey(value);
        } else {
          // If not a valid base58 string, keep it as is
          console.warn(`Invalid base58 string for key ${key}: ${value}`);
          sanitizedAccounts[key] = value;
        }
      } catch (error) {
        // If it's not a valid PublicKey, keep it as is
        console.warn(`Failed to convert string to PublicKey for key ${key}: ${value}`, error);
        sanitizedAccounts[key] = value;
      }
    } else {
      // Keep other values as is
      sanitizedAccounts[key] = value;
    }
  }
  
  return sanitizedAccounts;
}

/**
 * Executes a transaction using the fee payer script
 * @param program The program to execute
 * @param methodBuilder The method builder to use
 * @param accounts The accounts to use
 * @param signer The Para signer to use for signing the transaction
 * @returns The transaction signature
 */
export async function executeTransactionWithFeePayer(
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
    
    // Build the transaction without sending it
    const tx = await methodBuilder
      .accounts(accounts)
      .transaction();

    // Get the latest blockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Set the fee payer explicitly
    tx.feePayer = FEE_PAYER_PUBKEY;
    console.log('Setting fee payer:', FEE_PAYER_PUBKEY.toString());
    
    // Log transaction details before sending to server
    console.log('Transaction before server signing:', {
      recentBlockhash: tx.recentBlockhash,
      feePayer: tx.feePayer.toString(),
      instructions: tx.instructions.length,
      signers: tx.signatures.length,
      ownerPubkey: ownerPubkey.toString()
    });

    // Serialize the transaction
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }).toString('base64');

    // Log the serialized transaction for debugging
    console.log('Serialized transaction:', serializedTx);

    // Send the transaction to the script to be signed and executed
    const response = await fetch('/api/sign-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serializedTx: serializedTx
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to send transaction: ${errorData.error || response.statusText}${errorData.details ? `\nDetails: ${errorData.details}` : ''}`);
    }

    const result = await response.json();
    console.log('Transaction result from server:', result);

    // Deserialize the transaction that was signed by the fee payer
    const partiallySignedTx = Transaction.from(Buffer.from(result.signedTx, 'base64'));
    
    // Log the partially signed transaction details
    console.log('Partially signed transaction:', {
      recentBlockhash: partiallySignedTx.recentBlockhash,
      feePayer: partiallySignedTx.feePayer?.toString(),
      instructions: partiallySignedTx.instructions.length,
      signers: partiallySignedTx.signatures.length
    });
    
    // Check if the fee payer signature is present
    const feePayerSignature = partiallySignedTx.signatures.find(
      sig => sig.publicKey.equals(FEE_PAYER_PUBKEY)
    );
    
    if (!feePayerSignature || !feePayerSignature.signature) {
      throw new Error('Fee payer signature is missing from the transaction');
    }
    
    console.log('Fee payer signature is present');

    // Sign the transaction with the owner using the Para signer's signTransaction method
    console.log('Signing transaction with owner key:', ownerPubkey.toString());
    const fullySignedTx = await signer.signTransaction(partiallySignedTx);
    
    // Verify that both signatures are present
    const ownerSignature = fullySignedTx.signatures.find(
      sig => sig.publicKey.equals(ownerPubkey)
    );
    
    if (!ownerSignature || !ownerSignature.signature) {
      throw new Error('Owner signature is missing from the transaction');
    }
    
    console.log('Owner signature is present');

    // Send the fully signed transaction
    const connection = program.provider.connection;
    console.log('Sending fully signed transaction to the network');
    const signature = await connection.sendRawTransaction(fullySignedTx.serialize(), {
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