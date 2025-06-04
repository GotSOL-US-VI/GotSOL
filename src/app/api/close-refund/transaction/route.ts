import { NextRequest, NextResponse } from 'next/server';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram
} from '@solana/web3.js';
import { 
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS 
} from '@solana/actions';
import * as anchor from '@coral-xyz/anchor';
import { getGotsolProgram } from '@/utils/gotsol-exports';

// RPC URL configuration
function getRpcUrl(network: string): string {
  if (network === 'devnet') {
    return process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com';
  } else {
    return process.env.NEXT_PUBLIC_MAINNET_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  }
}

// GET handler - returns the close refund action metadata
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const refundTxParam = url.searchParams.get('refund_tx');
  const network = url.searchParams.get('network') || 'devnet';

  if (!refundTxParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: refund_tx' },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  const response: ActionGetResponse = {
    type: "action",
    title: "Close Refund Record",
    icon: `${process.env.NEXT_PUBLIC_PRODUCTION_URL || 'http://localhost:3000'}/gotsol-logo.png`,
    description: `Close refund record and reclaim SOL (Admin only)`,
    label: "Close Refund",
    links: {
      actions: [
        {
          label: "Confirm Closure",
          href: `/api/close-refund/transaction?refund_tx=${refundTxParam}&network=${network}`,
          type: "post",
        }
      ]
    }
  };

  return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });
}

// POST handler - creates and returns the close refund transaction
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const refundTxParam = url.searchParams.get('refund_tx');
    const network = url.searchParams.get('network') || 'devnet';

    if (!refundTxParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: refund_tx' },
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

    const authPubkey = new PublicKey(body.account);
    const refundTxSig = refundTxParam;

    // Setup connection
    const rpcUrl = getRpcUrl(network);
    const connection = new Connection(rpcUrl, { commitment: 'confirmed' });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create transaction
    const transaction = new Transaction({
      feePayer: authPubkey,
      blockhash,
      lastValidBlockHeight,
    });

    // Create close refund instruction
    const tempProvider = new anchor.AnchorProvider(
      connection,
      {
        publicKey: authPubkey,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      },
      { commitment: 'confirmed' }
    );
    
    const program = getGotsolProgram(tempProvider);
    
    // Find the refund record PDA
    const [refundRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("refund"), Buffer.from(refundTxSig)],
      program.programId
    );
    
    const closeRefundInstruction = await program.methods
      .closeRefund()
      .accounts({
        auth: authPubkey,
        refundRecord: refundRecordPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    transaction.add(closeRefundInstruction);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      message: `Close refund record and reclaim SOL (Admin only)`
    };

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