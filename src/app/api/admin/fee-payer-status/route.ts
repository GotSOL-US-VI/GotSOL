import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// Simple admin authentication (you can enhance this)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-admin-secret';

export async function GET(request: NextRequest) {
  try {
    // Basic admin authentication
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const FEE_PAYER_SECRET = process.env.FEE_PAYER_PRIVATE_KEY;
    
    if (!FEE_PAYER_SECRET) {
      return NextResponse.json({
        status: 'disabled',
        message: 'Fee payer not configured',
        feePayerEnabled: false
      });
    }

    // Get network from query params
    const url = new URL(request.url);
    const network = url.searchParams.get('network') || 'devnet';
    
    const rpcUrl = network === 'devnet' 
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';
    
    const connection = new Connection(rpcUrl, 'confirmed');

    // Parse fee payer keypair
    let feePayerKeypair: Keypair;
    try {
      const secretKey = bs58.decode(FEE_PAYER_SECRET);
      feePayerKeypair = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid fee payer private key format',
        feePayerEnabled: false
      });
    }

    const feePayerPubkey = feePayerKeypair.publicKey;

    // Get balance
    const balance = await connection.getBalance(feePayerPubkey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    // Calculate transaction estimates
    const estimatedTransactions = Math.floor(balance / 5000); // ~5000 lamports per transaction
    const estimatedATACreations = Math.floor(balance / 2000000); // ~2M lamports per ATA

    // Health checks
    const isHealthy = balanceSOL > 0.01; // Alert if less than 0.01 SOL
    const needsRefill = balanceSOL < 0.05; // Warning if less than 0.05 SOL

    return NextResponse.json({
      status: 'active',
      feePayerEnabled: true,
      network,
      publicKey: feePayerPubkey.toString(),
      balance: {
        lamports: balance,
        sol: balanceSOL,
        formatted: `${balanceSOL.toFixed(4)} SOL`
      },
      estimates: {
        transactions: estimatedTransactions,
        ataCreations: estimatedATACreations,
        combinedOperations: Math.floor(estimatedTransactions * 0.8) // Assume 80% are simple transfers
      },
      health: {
        isHealthy,
        needsRefill,
        status: !isHealthy ? 'critical' : needsRefill ? 'warning' : 'good',
        message: !isHealthy 
          ? 'Balance critically low - immediate refill needed'
          : needsRefill 
          ? 'Balance low - refill recommended'
          : 'Balance healthy'
      },
      recommendations: {
        minimumBalance: '0.01 SOL',
        recommendedBalance: '0.1 SOL',
        optimalBalance: '0.5 SOL'
      },
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking fee payer status:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to check fee payer status',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint for monitoring services
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, network = 'devnet' } = body;

    if (action === 'health-check') {
      // Quick health check without authentication for monitoring
      const FEE_PAYER_SECRET = process.env.FEE_PAYER_PRIVATE_KEY;
      
      if (!FEE_PAYER_SECRET) {
        return NextResponse.json({
          healthy: false,
          reason: 'Fee payer not configured'
        });
      }

      const rpcUrl = network === 'devnet' 
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com';
      
      const connection = new Connection(rpcUrl, 'confirmed');
      
      try {
        const secretKey = bs58.decode(FEE_PAYER_SECRET);
        const feePayerKeypair = Keypair.fromSecretKey(secretKey);
        const balance = await connection.getBalance(feePayerKeypair.publicKey);
        const balanceSOL = balance / LAMPORTS_PER_SOL;
        
        return NextResponse.json({
          healthy: balanceSOL > 0.01,
          balance: balanceSOL,
          network
        });
      } catch (error) {
        return NextResponse.json({
          healthy: false,
          reason: 'Failed to check balance'
        });
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json(
      { healthy: false, reason: 'Server error' },
      { status: 500 }
    );
  }
} 