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
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS 
} from '@solana/actions';
import bs58 from 'bs58';
import * as anchor from '@coral-xyz/anchor';
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { HOUSE } from '@/utils/token-utils';

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
  console.warn("FEE_PAYER_PRIVATE_KEY not found in environment variables. Fee payer functionality disabled for close merchant operations.");
} else {
  console.log("Fee payer configured successfully for close merchant transaction sponsorship.");
}

// GET handler - returns the close merchant action metadata
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const merchantParam = url.searchParams.get('merchant');
  const network = url.searchParams.get('network') || 'devnet';

  console.log('GET request for close merchant action:', {
    merchant: merchantParam?.slice(0, 8) + '...',
    network
  });

  if (!merchantParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: merchant' },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  try {
    const response: ActionGetResponse = {
      type: "action",
      title: "Close Merchant Account",
      icon: `${process.env.NEXT_PUBLIC_PRODUCTION_URL || 'http://localhost:3000'}/gotsol-logo.png`,
      description: "Permanently close merchant account and reclaim SOL (all USDC funds must be withdrawn first)",
      label: "Close Account",
      links: {
        actions: [
          {
            label: "Confirm Closure",
            href: `/api/close-merchant/transaction?merchant=${merchantParam}&network=${network}`,
            type: "post",
          }
        ]
      }
    };

    return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });

  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Failed to generate close merchant action' },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}

// POST handler - creates and returns the close merchant transaction
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const merchantParam = url.searchParams.get('merchant');
    const network = url.searchParams.get('network') || 'devnet';

    console.log('POST request for close merchant transaction creation:', {
      merchant: merchantParam?.slice(0, 8) + '...',
      network,
      rpcUrl: getRpcUrl(network)
    });

    if (!merchantParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: merchant' },
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

    // Setup connection
    const connection = getConnection(network);

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
          { error: 'Unauthorized: Only merchant owner can close the account' },
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

    // Smart fee payer logic with automatic fallback for eligible merchants
    if (FEE_PAYER_SECRET && isFeeEligible) {
      console.log('✅ CLOSE_MERCHANT: Fee payer secret available for eligible merchant');
      try {
        const secretKey = bs58.decode(FEE_PAYER_SECRET);
        feePayerKeypair = Keypair.fromSecretKey(secretKey);
        
        console.log('🔑 CLOSE_MERCHANT: Fee payer keypair created:', feePayerKeypair.publicKey.toString());
        
        // Check server fee payer balance for smart fallback
        const feePayerBalance = await connection.getBalance(feePayerKeypair.publicKey);
        const feePayerSOL = feePayerBalance / LAMPORTS_PER_SOL;
        
        console.log('💰 CLOSE_MERCHANT: Fee payer balance check:', {
          balance: feePayerBalance,
          balanceSOL: feePayerSOL.toFixed(6),
          minimumRequired: 10000
        });
        
        // Minimum balance check - fallback to owner if server has insufficient funds
        const minimumBalance = 10000; // ~0.00001 SOL
        if (feePayerBalance >= minimumBalance) {
          feePayer = feePayerKeypair.publicKey;
          usingServerFeePayer = true;
          console.log('🎉 CLOSE_MERCHANT: Using server fee payer for eligible merchant:', feePayer.toString());
          console.log(`💸 CLOSE_MERCHANT: Server fee payer balance: ${feePayerSOL.toFixed(4)} SOL`);
        } else {
          console.warn(`⚠️ CLOSE_MERCHANT: Server fee payer balance too low (${feePayerSOL.toFixed(6)} SOL), falling back to owner payment`);
          feePayerKeypair = null; // Don't use server keypair
          feePayer = ownerPubkey;
          usingServerFeePayer = false;
        }
        
      } catch (error) {
        console.warn('❌ CLOSE_MERCHANT: Invalid fee payer secret key, falling back to owner paying fees:', error);
        feePayerKeypair = null;
        feePayer = ownerPubkey;
        usingServerFeePayer = false;
      }
    } else if (!isFeeEligible) {
      console.log('❌ CLOSE_MERCHANT: Merchant not eligible for fee-paying service, owner will pay fees');
    } else {
      console.log('❌ CLOSE_MERCHANT: Server fee payer not configured, owner will pay fees');
    }

    console.log('Close merchant transaction details:', {
      owner: ownerPubkey.toString(),
      merchant: merchantPubkey.toString(),
      feePayer: feePayer.toString(),
      usingServerFeePayer,
      merchantFeeEligible: isFeeEligible,
      network
    });

    // Create transaction
    const transaction = new Transaction({
      feePayer,
      blockhash,
      lastValidBlockHeight,
    });

    // Create close merchant instruction using the program
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
      
      const closeMerchantInstruction = await program.methods
        .closeMerchant()
        .accounts({
          owner: ownerPubkey,
          merchant: merchantPubkey,
          house: HOUSE,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      
      transaction.add(closeMerchantInstruction);
      console.log('Added close merchant instruction');
      
    } catch (error) {
      console.error('Failed to create close merchant instruction:', error);
      return NextResponse.json(
        { error: 'Failed to create close merchant instruction' },
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
    let message = `Close merchant account and reclaim SOL`;
    
    if (usingServerFeePayer) {
      message += ` (GotSOL will cover transaction fees)`;
    } else {
      message += ` (you will pay transaction fees)`;
    }

    if (network === 'devnet') {
      message += ' [Devnet Transaction]';
    }

    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      message
    };

    console.log('Close merchant transaction created successfully:', {
      merchant: merchantPubkey.toString().slice(0, 8) + '...',
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