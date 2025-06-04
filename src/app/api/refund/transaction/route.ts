import { NextRequest, NextResponse } from 'next/server';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError 
} from '@solana/spl-token';
import { 
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS 
} from '@solana/actions';
import bs58 from 'bs58';
import * as anchor from '@coral-xyz/anchor';
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { USDC_MINT, USDC_DEVNET_MINT, findAssociatedTokenAddress } from '@/utils/token-utils';

// RPC URL configuration
function getRpcUrl(network: string): string {
  if (network === 'devnet') {
    return process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com';
  } else {
    return process.env.NEXT_PUBLIC_MAINNET_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  }
}

// Get optimized connection
function getConnection(network: string): Connection {
  const rpcUrl = getRpcUrl(network);
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000
  });
}

// Server fee payer configuration
const FEE_PAYER_SECRET = process.env.FEE_PAYER_PRIVATE_KEY;

if (!FEE_PAYER_SECRET) {
  console.warn("FEE_PAYER_PRIVATE_KEY not found in environment variables. Fee payer functionality disabled for refunds.");
} else {
  console.log("Fee payer configured successfully for refund transaction sponsorship.");
}

// GET handler - returns the refund action metadata
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const merchantParam = url.searchParams.get('merchant');
  const amountParam = url.searchParams.get('amount');
  const recipientParam = url.searchParams.get('recipient');
  const txSigParam = url.searchParams.get('txSig');
  const network = url.searchParams.get('network') || 'devnet';

  console.log('GET request for refund action:', {
    merchant: merchantParam?.slice(0, 8) + '...',
    amount: amountParam,
    recipient: recipientParam?.slice(0, 8) + '...',
    txSig: txSigParam?.slice(0, 8) + '...',
    network
  });

  if (!merchantParam || !amountParam || !recipientParam || !txSigParam) {
    return NextResponse.json(
      { error: 'Missing required parameters: merchant, amount, recipient, and txSig' },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  try {
    const amount = parseFloat(amountParam);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    const response: ActionGetResponse = {
      type: "action",
      title: `Refund $${amount} USDC`,
      icon: `${process.env.NEXT_PUBLIC_PRODUCTION_URL || 'http://localhost:3000'}/gotsol-logo.png`,
      description: `Refund $${amount} USDC to customer from merchant account`,
      label: "Process Refund",
      links: {
        actions: [
          {
            label: "Confirm Refund",
            href: `/api/refund/transaction?merchant=${merchantParam}&amount=${amountParam}&recipient=${recipientParam}&txSig=${txSigParam}&network=${network}`,
            type: "post",
          }
        ]
      }
    };

    return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });

  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Failed to generate refund action' },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}

// POST handler - creates and returns the refund transaction
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const merchantParam = url.searchParams.get('merchant');
    const amountParam = url.searchParams.get('amount');
    const recipientParam = url.searchParams.get('recipient');
    const txSigParam = url.searchParams.get('txSig');
    const network = url.searchParams.get('network') || 'devnet';

    console.log('POST request for refund transaction creation:', {
      merchant: merchantParam?.slice(0, 8) + '...',
      amount: amountParam,
      recipient: recipientParam?.slice(0, 8) + '...',
      txSig: txSigParam?.slice(0, 8) + '...',
      network,
      rpcUrl: getRpcUrl(network)
    });

    if (!merchantParam || !amountParam || !recipientParam || !txSigParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: merchant, amount, recipient, and txSig' },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    const body: ActionPostRequest = await request.json();
    
    if (!body.account) {
      return NextResponse.json(
        { error: 'Missing account in request body' },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    const merchantPubkey = new PublicKey(merchantParam);
    const ownerPubkey = new PublicKey(body.account);
    const recipientPubkey = new PublicKey(recipientParam);
    const amount = parseFloat(amountParam);
    
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Convert amount to USDC lamports (6 decimals)
    const amountLamports = Math.floor(amount * 1_000_000);

    // Setup connection
    const connection = getConnection(network);
    
    // Get USDC mint for the network
    const usdcMint = network === 'devnet' ? USDC_DEVNET_MINT : USDC_MINT;

    // Get recent blockhash
    let blockhash: string;
    let lastValidBlockHeight: number;
    
    try {
      const result = await connection.getLatestBlockhash('confirmed');
      blockhash = result.blockhash;
      lastValidBlockHeight = result.lastValidBlockHeight;
    } catch (error) {
      console.error('Failed to get recent blockhash:', error);
      return NextResponse.json(
        { error: 'Network error: failed to get recent blockhash' },
        { status: 503, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Check merchant account and fee eligibility
    let merchantAccount: any;
    let isFeeEligible = false;
    
    try {
      // Create a temporary provider to check merchant status
      const tempProvider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: ownerPubkey,
          signTransaction: async (tx) => tx, // Dummy signer
          signAllTransactions: async (txs) => txs,
        },
        { commitment: 'confirmed' }
      );
      
      const program = getGotsolProgram(tempProvider);
      merchantAccount = await (program.account as any).merchant.fetch(merchantPubkey);
      isFeeEligible = merchantAccount.feeEligible;
      
      // Verify the owner is authorized
      if (!merchantAccount.owner.equals(ownerPubkey)) {
        return NextResponse.json(
          { error: 'Unauthorized: Only merchant owner can process refunds' },
          { status: 403, headers: ACTIONS_CORS_HEADERS }
        );
      }
      
      console.log('Merchant account status:', {
        owner: merchantAccount.owner.toString(),
        feeEligible: isFeeEligible,
        entityName: merchantAccount.entityName
      });
      
    } catch (error) {
      console.error('Failed to fetch merchant account:', error);
      return NextResponse.json(
        { error: 'Merchant account not found or invalid' },
        { status: 404, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Determine fee payer based on merchant eligibility and server configuration
    let feePayerKeypair: Keypair | null = null;
    let feePayer: PublicKey = ownerPubkey; // Default to owner paying fees
    let usingServerFeePayer = false;

    // Enhanced debugging for fee payer logic
    console.log('🔍 DEBUG - Fee payer determination:', {
      isFeeEligible,
      hasFeePayerSecret: !!FEE_PAYER_SECRET,
      feePayerSecretLength: FEE_PAYER_SECRET?.length || 0
    });

    if (isFeeEligible && FEE_PAYER_SECRET) {
      console.log('✅ REFUND: Merchant is eligible and fee payer secret is available');
      try {
        const secretKey = bs58.decode(FEE_PAYER_SECRET);
        feePayerKeypair = Keypair.fromSecretKey(secretKey);
        
        console.log('🔑 REFUND: Fee payer keypair created:', feePayerKeypair.publicKey.toString());
        
        // Check server fee payer balance for smart fallback
        const feePayerBalance = await connection.getBalance(feePayerKeypair.publicKey);
        const feePayerSOL = feePayerBalance / LAMPORTS_PER_SOL;
        
        console.log('💰 REFUND: Fee payer balance check:', {
          balance: feePayerBalance,
          balanceSOL: feePayerSOL.toFixed(6),
          minimumRequired: 10000
        });
        
        // Minimum balance check - fallback to owner if server has insufficient funds
        const minimumBalance = 10000; // ~0.00001 SOL
        if (feePayerBalance >= minimumBalance) {
          feePayer = feePayerKeypair.publicKey;
          usingServerFeePayer = true;
          console.log('🎉 REFUND: Using server fee payer for eligible merchant:', feePayer.toString());
          console.log(`💸 REFUND: Server fee payer balance: ${feePayerSOL.toFixed(4)} SOL`);
        } else {
          console.warn(`⚠️ REFUND: Server fee payer balance too low (${feePayerSOL.toFixed(6)} SOL), falling back to owner payment`);
          feePayerKeypair = null; // Don't use server keypair
        }
        
      } catch (error) {
        console.warn('❌ REFUND: Server fee payer issue, falling back to owner paying fees:', error);
      }
    } else if (!isFeeEligible) {
      console.log('❌ REFUND: Merchant not eligible for fee-paying service, owner will pay fees');
    } else {
      console.log('❌ REFUND: Server fee payer not configured, owner will pay fees');
    }

    console.log('Refund transaction details:', {
      owner: ownerPubkey.toString(),
      merchant: merchantPubkey.toString(),
      recipient: recipientPubkey.toString(),
      amount: `$${amount} USDC (${amountLamports} lamports)`,
      feePayer: feePayer.toString(),
      usingServerFeePayer,
      merchantFeeEligible: isFeeEligible,
      network,
      usdcMint: usdcMint.toString(),
      originalTxSig: txSigParam
    });

    // Create transaction
    const transaction = new Transaction({
      feePayer,
      blockhash,
      lastValidBlockHeight,
    });

    // Get associated token accounts
    const merchantUsdcAta = await findAssociatedTokenAddress(merchantPubkey, usdcMint);
    const recipientUsdcAta = await findAssociatedTokenAddress(recipientPubkey, usdcMint);

    // Check if recipient's USDC ATA exists
    let recipientAtaExists = false;
    try {
      await getAccount(connection, recipientUsdcAta);
      recipientAtaExists = true;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
        recipientAtaExists = false;
      } else {
        console.error('Unexpected error checking recipient ATA:', error);
        throw error;
      }
    }

    console.log('ATA existence check:', {
      recipientAta: recipientUsdcAta.toString(),
      recipientAtaExists,
      merchantAta: merchantUsdcAta.toString()
    });

    // If recipient's ATA doesn't exist, create it (fee payer covers this)
    if (!recipientAtaExists) {
      const createRecipientAtaInstruction = createAssociatedTokenAccountInstruction(
        feePayer, // Fee payer pays for ATA creation
        recipientUsdcAta,
        recipientPubkey, // Recipient owns the ATA
        usdcMint
      );
      transaction.add(createRecipientAtaInstruction);
      console.log('Added recipient USDC ATA creation instruction');
    }

    // Create refund instruction using the program
    try {
      const tempProvider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: ownerPubkey,
          signTransaction: async (tx) => tx,
          signAllTransactions: async (txs) => txs,
        },
        { commitment: 'confirmed' }
      );
      
      const program = getGotsolProgram(tempProvider);
      
      const refundInstruction = await program.methods
        .refund(txSigParam, new anchor.BN(amountLamports))
        .accounts({
          owner: ownerPubkey,
          merchant: merchantPubkey,
          stablecoinMint: usdcMint,
          merchantStablecoinAta: merchantUsdcAta,
          recipientStablecoinAta: recipientUsdcAta,
          recipient: recipientPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      
      transaction.add(refundInstruction);
      console.log('Added refund instruction');
      
    } catch (error) {
      console.error('Failed to create refund instruction:', error);
      return NextResponse.json(
        { error: 'Failed to create refund instruction' },
        { status: 500, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // If using server fee payer, partially sign the transaction
    if (feePayerKeypair) {
      try {
        transaction.partialSign(feePayerKeypair);
        console.log('Server fee payer successfully signed transaction');
      } catch (error) {
        console.error('Failed to sign transaction with server fee payer:', error);
        return NextResponse.json(
          { error: 'Server fee payer signing failed' },
          { status: 500, headers: ACTIONS_CORS_HEADERS }
        );
      }
    }

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false, // Owner still needs to sign
      verifySignatures: false,
    });

    // Create informative message
    let message = `Refund $${amount} USDC to customer`;
    
    if (usingServerFeePayer) {
      const services = [];
      if (!recipientAtaExists) services.push('recipient USDC account creation');
      services.push('transaction fees');
      
      message += ` (GotSOL will cover ${services.join(' and ')})`;
    } else {
      message += ` (you will pay transaction fees`;
      if (!recipientAtaExists) message += ' and USDC account creation';
      message += ')';
    }

    if (network === 'devnet') {
      message += ' [Devnet Transaction]';
    }

    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      message
    };

    console.log('Refund transaction created successfully:', {
      amount: `$${amount} USDC`,
      merchant: merchantPubkey.toString().slice(0, 8) + '...',
      recipient: recipientPubkey.toString().slice(0, 8) + '...',
      processingTime: `${Date.now() - startTime}ms`,
      transactionSize: `${serializedTransaction.length} bytes`,
      feePaidBy: usingServerFeePayer ? 'Server' : 'Owner',
      merchantFeeEligible: isFeeEligible
    });

    return NextResponse.json(response, { 
      headers: ACTIONS_CORS_HEADERS 
    });

  } catch (error) {
    console.error('Error in POST handler:', error);
    
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
} 