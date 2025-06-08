#!/usr/bin/env node

const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');

async function createMockTokens() {
  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  
  // Load fee payer from file
  let feePayer;
  try {
    const keyData = JSON.parse(fs.readFileSync('fee-payer.json', 'utf8'));
    feePayer = Keypair.fromSecretKey(new Uint8Array(keyData));
    console.log('Fee payer loaded:', feePayer.publicKey.toString());
  } catch (error) {
    console.error('Error loading fee-payer.json:', error.message);
    console.log('Please make sure fee-payer.json exists in the project root');
    process.exit(1);
  }

  // Check fee payer balance
  const balance = await connection.getBalance(feePayer.publicKey);
  console.log('Fee payer balance:', balance / 1e9, 'SOL');
  
  if (balance < 1e9) { // Less than 1 SOL
    console.log('Fee payer needs more SOL. Requesting airdrop...');
    try {
      const signature = await connection.requestAirdrop(feePayer.publicKey, 2e9);
      await connection.confirmTransaction(signature);
      console.log('Airdrop successful');
    } catch (error) {
      console.error('Airdrop failed:', error.message);
      console.log('Please manually fund the fee payer address:', feePayer.publicKey.toString());
      process.exit(1);
    }
  }

  // Target address to mint tokens to
  const targetAddress = new PublicKey('H3UhG7FPi7ne31uiytr6iFL8oE4KiRv6AsxvmttifD2K');
  
  // Token configurations
  const tokens = [
    { name: 'Mock USDT', symbol: 'USDT', decimals: 6 },
    { name: 'Mock USDG', symbol: 'USDG', decimals: 6 },
    { name: 'Mock FDUSD', symbol: 'FDUSD', decimals: 6 },
  ];

  const results = [];

  for (const token of tokens) {
    console.log(`\nCreating ${token.name} (${token.symbol})...`);
    
    try {
      // Create the mint
      const mint = await createMint(
        connection,
        feePayer,        // Payer
        feePayer.publicKey, // Mint authority
        feePayer.publicKey, // Freeze authority
        token.decimals   // Decimals
      );
      
      console.log(`✅ Created ${token.symbol} mint:`, mint.toString());
      
      // Get or create associated token account for target address
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        feePayer,
        mint,
        targetAddress
      );
      
      console.log(`✅ Created/found token account:`, tokenAccount.address.toString());
      
      // Mint 1000 tokens (adjusted for decimals)
      const amount = 1000 * Math.pow(10, token.decimals);
      
      const mintSignature = await mintTo(
        connection,
        feePayer,
        mint,
        tokenAccount.address,
        feePayer.publicKey,
        amount
      );
      
      console.log(`✅ Minted 1000 ${token.symbol} tokens. Signature:`, mintSignature);
      
      results.push({
        symbol: token.symbol,
        name: token.name,
        mint: mint.toString(),
        decimals: token.decimals,
        tokenAccount: tokenAccount.address.toString(),
        mintSignature
      });
      
    } catch (error) {
      console.error(`❌ Error creating ${token.symbol}:`, error.message);
    }
  }

  // Save results to file
  const outputFile = 'mock-tokens-devnet.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\n📄 Results saved to ${outputFile}`);
  console.log('\n🎉 Mock tokens created successfully!');
  
  // Display summary
  console.log('\n📋 Summary:');
  results.forEach(token => {
    console.log(`${token.symbol}: ${token.mint}`);
  });
  
  console.log('\n📝 Next steps:');
  console.log('1. Update your stablecoin configuration with these mint addresses');
  console.log('2. Test payments with these mock tokens');
  console.log(`3. Target address ${targetAddress.toString()} now has 1000 of each token`);
}

// Run the script
createMockTokens().catch(console.error); 