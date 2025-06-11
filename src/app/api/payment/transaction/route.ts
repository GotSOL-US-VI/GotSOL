import { NextRequest, NextResponse } from 'next/server';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError 
} from '@solana/spl-token';
import { 
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS 
} from '@solana/actions';
import bs58 from 'bs58';
import { getStablecoinMint, getStablecoinDecimals, STABLECOINS, isValidStablecoin, isNativeToken } from '@/utils/stablecoin-config';

// RPC URL configuration optimized for your environment
function getRpcUrl(network: string): string {
  if (network === 'devnet') {
    // Use your Helius RPC for better performance and reliability
    return process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com';
  } else {
    // Use your mainnet Helius RPC 
    return process.env.NEXT_PUBLIC_MAINNET_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  }
}

// Connection pool for better performance
const connectionCache = new Map<string, Connection>();

function getConnection(network: string): Connection {
  const rpcUrl = getRpcUrl(network);
  
  if (!connectionCache.has(rpcUrl)) {
    const connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
      httpHeaders: {
        'Content-Type': 'application/json',
      },
    });
    connectionCache.set(rpcUrl, connection);
    console.log(`Created new connection for ${network} using ${rpcUrl}`);
  }
  
  return connectionCache.get(rpcUrl)!;
}

// Synchronous function to get associated token address (consistent with frontend)
function getAssociatedTokenAddressSync(walletAddress: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer()
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

// Your fee payer keypair - loaded from environment variables
const FEE_PAYER_SECRET = process.env.FEE_PAYER_PRIVATE_KEY;

if (!FEE_PAYER_SECRET) {
  console.warn("FEE_PAYER_PRIVATE_KEY not found in environment variables. Fee payer functionality disabled.");
  console.warn("To enable fee sponsorship, add FEE_PAYER_PRIVATE_KEY to your environment variables.");
} else {
  console.log("Fee payer configured successfully for transaction sponsorship.");
}

// GET handler - returns the action metadata
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const merchantParam = url.searchParams.get('merchant');
  const amountParam = url.searchParams.get('amount');
  const network = url.searchParams.get('network') || 'devnet';
  const token = url.searchParams.get('token') || 'USDC';
  const memo = url.searchParams.get('memo');

  // Log the incoming request for debugging
  console.log('GET request for payment action:', {
    merchant: merchantParam?.slice(0, 8) + '...',
    amount: amountParam,
    token: token.toUpperCase(),
    network,
    hasMemo: !!memo
  });

  if (!merchantParam || !amountParam) {
    return NextResponse.json(
      { error: 'Missing required parameters: merchant and amount' },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }

  try {
    const merchantPubkey = new PublicKey(merchantParam);
    const amount = parseFloat(amountParam);
    const tokenUpper = token.toUpperCase();

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Validate token
    if (!isValidStablecoin(tokenUpper)) {
      return NextResponse.json(
        { error: `Unsupported token: ${tokenUpper}` },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    const tokenConfig = STABLECOINS[tokenUpper];
    const networkDisplay = network === 'devnet' ? '(Devnet)' : '';

    const response: ActionGetResponse = {
      icon: `${url.origin}/api/payment/icon`,
      label: `Pay $${amount} ${tokenUpper}`,
      title: `Pay $${amount} ${tokenConfig.name} ${networkDisplay}`,
      description: `Send $${amount} ${tokenUpper} to merchant ${merchantPubkey.toString().slice(0, 4)}...${merchantPubkey.toString().slice(-4)}${memo ? ` - ${memo}` : ''} ${networkDisplay}`,
      links: {
        actions: [
          {
            label: `Pay $${amount} ${tokenUpper}`,
            href: url.toString(),
            type: "transaction"
          }
        ]
      }
    };

    return NextResponse.json(response, { 
      headers: ACTIONS_CORS_HEADERS 
    });
  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Invalid merchant public key' },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }
}

// POST handler - creates and returns the transaction
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const merchantParam = url.searchParams.get('merchant');
    const amountParam = url.searchParams.get('amount');
    const network = url.searchParams.get('network') || 'devnet';
    const token = url.searchParams.get('token') || 'USDC';
    const memo = url.searchParams.get('memo');

    console.log('POST request for transaction creation:', {
      merchant: merchantParam?.slice(0, 8) + '...',
      amount: amountParam,
      token: token.toUpperCase(),
      network,
      hasMemo: !!memo,
      rpcUrl: getRpcUrl(network)
    });

    if (!merchantParam || !amountParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: merchant and amount' },
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
    const payerPubkey = new PublicKey(body.account);
    const amount = parseFloat(amountParam);
    const tokenUpper = token.toUpperCase();
    
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Validate token
    if (!isValidStablecoin(tokenUpper)) {
      return NextResponse.json(
        { error: `Unsupported token: ${tokenUpper}` },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Get token configuration and convert amount to lamports
    const tokenDecimals = getStablecoinDecimals(tokenUpper);
    const amountLamports = Math.floor(amount * Math.pow(10, tokenDecimals));
    const isNative = isNativeToken(tokenUpper);

    // Setup optimized connection using your Helius RPC
    const connection = getConnection(network);
    
    // Get token mint for the network (only needed for SPL tokens)
    const tokenMint = isNative ? null : getStablecoinMint(tokenUpper, network === 'devnet');

    // Get recent blockhash with retry logic
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

    // Create fee payer keypair if available
    let feePayerKeypair: Keypair | null = null;
    let feePayer: PublicKey = payerPubkey; // Default to payer paying their own fees

    if (FEE_PAYER_SECRET) {
      try {
        const secretKey = bs58.decode(FEE_PAYER_SECRET);
        feePayerKeypair = Keypair.fromSecretKey(secretKey);
        feePayer = feePayerKeypair.publicKey;
        console.log('Using fee payer service:', feePayer.toString());
        
        // Quick balance check for fee payer on devnet
        if (network === 'devnet') {
          try {
            const feePayerBalance = await connection.getBalance(feePayer);
            const feePayerSOL = feePayerBalance / LAMPORTS_PER_SOL;
            console.log(`Fee payer balance: ${feePayerSOL.toFixed(4)} SOL`);
            
            if (feePayerBalance < 10000) { // Less than 0.00001 SOL
              console.warn('Fee payer balance is very low, may fail to cover fees');
            }
          } catch (error) {
            console.warn('Failed to check fee payer balance:', error);
          }
        }
      } catch (error) {
        console.warn('Invalid fee payer secret key, falling back to payer paying fees:', error);
      }
    }

    console.log('Transaction details:', {
      payer: payerPubkey.toString(),
      merchant: merchantPubkey.toString(),
      amount: `$${amount} ${tokenUpper} (${amountLamports} lamports)`,
      feePayer: feePayer.toString(),
      usingFeePayerService: !!feePayerKeypair,
      network,
      token: tokenUpper,
      isNative,
      tokenMint: tokenMint?.toString() || 'N/A (native SOL)'
    });

    // Create transaction with optimized settings
    const transaction = new Transaction({
      feePayer, // Fee payer pays the transaction fees
      blockhash,
      lastValidBlockHeight,
    });

    if (isNative) {
      // Handle native SOL transfer
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: merchantPubkey,
        lamports: amountLamports,
      });
      transaction.add(transferInstruction);
      console.log(`Added native SOL transfer instruction: ${amountLamports} lamports`);
    } else {
      // Handle SPL token transfer
      if (!tokenMint) {
        throw new Error('Token mint is required for SPL token transfers');
      }

      // Get associated token accounts
      const payerAta = getAssociatedTokenAddressSync(payerPubkey, tokenMint);
      const merchantAta = getAssociatedTokenAddressSync(merchantPubkey, tokenMint);

      // Check if payer ATA exists with optimized error handling
      let payerAtaExists = false;
      try {
        await getAccount(connection, payerAta);
        payerAtaExists = true;
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
          payerAtaExists = false;
        } else {
          console.error('Unexpected error checking payer ATA:', error);
          throw error;
        }
      }

      // Check if merchant ATA exists with optimized error handling
      let merchantAtaExists = false;
      try {
        await getAccount(connection, merchantAta);
        merchantAtaExists = true;
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
          merchantAtaExists = false;
        } else {
          console.error('Unexpected error checking merchant ATA:', error);
          throw error;
        }
      }

      console.log('ATA existence check:', {
        payerAta: payerAta.toString(),
        payerAtaExists,
        merchantAta: merchantAta.toString(),
        merchantAtaExists,
        checkDuration: `${Date.now() - startTime}ms`
      });

      // If payer ATA doesn't exist, create it (fee payer pays for this)
      if (!payerAtaExists) {
        const createPayerAtaInstruction = createAssociatedTokenAccountInstruction(
          feePayer, // Fee payer pays for ATA creation
          payerAta,
          payerPubkey, // Payer owns the ATA
          tokenMint
        );
        transaction.add(createPayerAtaInstruction);
        console.log(`Added payer ${tokenUpper} ATA creation instruction`);
      }

      // If merchant ATA doesn't exist, create it (fee payer pays for this)
      if (!merchantAtaExists) {
        const createAtaInstruction = createAssociatedTokenAccountInstruction(
          feePayer, // Fee payer pays for ATA creation
          merchantAta,
          merchantPubkey, // Merchant owns the ATA
          tokenMint
        );
        transaction.add(createAtaInstruction);
        console.log(`Added merchant ${tokenUpper} ATA creation instruction`);
      }

      // Create the SPL token transfer instruction
      const transferInstruction = createTransferInstruction(
        payerAta,      // From: payer's token ATA
        merchantAta,   // To: merchant's token ATA
        payerPubkey,   // Authority: payer signs for the transfer
        amountLamports // Amount in lamports
      );
      transaction.add(transferInstruction);
    }

    // Add memo if provided
    if (memo && memo.trim()) {
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(memo.trim(), 'utf8'),
      });
      transaction.add(memoInstruction);
      console.log('Added memo instruction:', memo.trim());
    }

    // If we have a fee payer keypair, partially sign the transaction
    if (feePayerKeypair) {
      try {
        transaction.partialSign(feePayerKeypair);
        console.log('Fee payer successfully signed transaction');
      } catch (error) {
        console.error('Failed to sign transaction with fee payer:', error);
        return NextResponse.json(
          { error: 'Fee payer signing failed' },
          { status: 500, headers: ACTIONS_CORS_HEADERS }
        );
      }
    }

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false, // Payer still needs to sign
      verifySignatures: false,
    });

    // Create informative message based on what's happening
    let message = `Payment of $${amount} ${tokenUpper} to merchant`;
    
    if (feePayerKeypair) {
      if (isNative) {
        message += ` (fees covered by GotSOL)`;
      } else {
        const ataCreations = [];
        // Note: These variables are only available in SPL token context
        // For now, keep generic messaging for cross-token compatibility
        message += ` (GotSOL covers account creation and fees)`;
      }
    } else if (!isNative) {
      message += ` (Note: ${tokenUpper} account creation may be required)`;
    }

    if (network === 'devnet') {
      message += ' [Devnet Transaction]';
    }

    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      message
    };

    console.log(`${tokenUpper} transaction created successfully:`, {
      amount: `$${amount} ${tokenUpper}`,
      merchant: merchantPubkey.toString().slice(0, 8) + '...',
      processingTime: `${Date.now() - startTime}ms`,
      transactionSize: `${serializedTransaction.length} bytes`,
      feePaidBy: feePayerKeypair ? 'GotSOL' : 'Customer',
      isNativeSOL: isNative
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

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: ACTIONS_CORS_HEADERS,
  });
} 