#!/usr/bin/env node

const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const fs = require('fs');
const path = require('path');

/**
 * Fee Payer Setup Script
 * 
 * This script helps you generate a fee payer keypair for Solana Pay transactions.
 * The fee payer will cover transaction fees and ATA creation costs for your customers.
 */

console.log('🚀 GotSOL Fee Payer Setup\n');

// Generate a new keypair
const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toString();
const privateKeyArray = Array.from(keypair.secretKey);
const privateKeyBase58 = bs58.encode(Buffer.from(keypair.secretKey));

// Save keypair to file
const keypairData = JSON.stringify(privateKeyArray);
const keypairPath = path.join(process.cwd(), 'fee-payer.json');

try {
  fs.writeFileSync(keypairPath, keypairData);
  console.log('✅ Fee payer keypair generated successfully!');
  console.log(`📁 Saved to: ${keypairPath}`);
} catch (error) {
  console.error('❌ Error saving keypair file:', error.message);
  process.exit(1);
}

console.log('\n📋 Keypair Details:');
console.log(`🔑 Public Key:  ${publicKey}`);
console.log(`🔐 Private Key: ${privateKeyBase58}`);

console.log('\n⚡ Next Steps:');
console.log('1. Add to your .env.local file:');
console.log(`   FEE_PAYER_PRIVATE_KEY=${privateKeyBase58}`);
console.log('\n2. Fund the fee payer with SOL:');
console.log('   For Devnet:');
console.log(`   solana airdrop 5 ${publicKey} --url devnet`);
console.log('\n   For Mainnet:');
console.log(`   solana transfer ${publicKey} 0.1 --url mainnet-beta`);
console.log('\n3. When deploying to Vercel, add the environment variable:');
console.log('   - Go to your Vercel project settings');
console.log('   - Add FEE_PAYER_PRIVATE_KEY with the private key value');
console.log('\n💡 Security Tips:');
console.log('- Keep the private key secure and never commit it to git');
console.log('- Monitor the fee payer balance regularly');
console.log('- Consider rotating keypairs periodically');
console.log(`- The keypair file (${keypairPath}) should be added to .gitignore`);

console.log('\n🎯 Cost Estimates:');
console.log('- Transaction fee: ~0.000005 SOL (~$0.001)');
console.log('- ATA creation: ~0.002 SOL (~$0.40)');
console.log('- 100 transactions + 50 ATAs/month: ~$20.10');

console.log('\n✨ Your customers will now pay $0 in fees! ✨');

// Create or update .gitignore
const gitignorePath = path.join(process.cwd(), '.gitignore');
const gitignoreEntry = 'fee-payer.json';

try {
  let gitignoreContent = '';
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  if (!gitignoreContent.includes(gitignoreEntry)) {
    gitignoreContent += gitignoreContent.endsWith('\n') ? '' : '\n';
    gitignoreContent += `${gitignoreEntry}\n`;
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log(`\n📝 Added ${gitignoreEntry} to .gitignore`);
  }
} catch (error) {
  console.warn(`\n⚠️  Warning: Could not update .gitignore - please add ${gitignoreEntry} manually`);
} 