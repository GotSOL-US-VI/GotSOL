import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import idl from "../src/utils/gotsol.json";
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROGRAM_ID = new PublicKey(idl.address);
const MERCHANT_PUBKEY = new PublicKey("7az97eW2PdvhputGwGqEQUYHmb7eZPRYkCfcKmrgGNee");
const AUTH_PUBKEY = new PublicKey("Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih");

async function enableMerchantFees() {
  try {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load the local CLI wallet
    const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
      console.error("❌ Local Solana CLI wallet not found at:", walletPath);
      return;
    }

    const secretKeyString = fs.readFileSync(walletPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const payer = Keypair.fromSecretKey(secretKey);
    
    console.log("🔑 Using CLI wallet:", payer.publicKey.toString());
    
    // Check if this wallet matches the AUTH key
    if (!payer.publicKey.equals(AUTH_PUBKEY)) {
      console.error("❌ CLI wallet does not match AUTH key!");
      return;
    }

    // Create provider
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(payer),
      { commitment: "confirmed" }
    );
    
    // Create program instance
    const program = new anchor.Program(idl as anchor.Idl, provider);
    
    console.log("🏪 Merchant:", MERCHANT_PUBKEY.toString());
    
    // Check current merchant status
    try {
      const merchantAccount = await (program.account as any).merchant.fetch(MERCHANT_PUBKEY);
      console.log("\n📊 Current Merchant Status:");
      console.log("- Fee Eligible:", merchantAccount.feeEligible);
      
      if (merchantAccount.feeEligible) {
        console.log("\n✅ Merchant is already fee eligible (true)");
        return;
      }
      
    } catch (error) {
      console.error("❌ Failed to fetch merchant account:", error);
      return;
    }
    
    console.log("\n🔄 Setting fee_eligible to TRUE...");
    
    // Call the set_merchant_status instruction
    const tx = await program.methods
      .setMerchantStatus(true) // Set fee_eligible to TRUE
      .accountsPartial({
        auth: payer.publicKey,
        merchant: MERCHANT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Transaction successful!");
    console.log("📜 Transaction signature:", tx);
    console.log("🔗 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    // Verify the change
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updatedMerchant = await (program.account as any).merchant.fetch(MERCHANT_PUBKEY);
    console.log("\n📊 Updated Merchant Status:");
    console.log("- Fee Eligible:", updatedMerchant.feeEligible);
    
    if (updatedMerchant.feeEligible) {
      console.log("🎉 Successfully ENABLED merchant fee eligibility!");
      console.log("💡 Now test your refund - the server should pay the fees!");
    } else {
      console.log("⚠️  Warning: fee_eligible is still false");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error);
  }
}

// Run the script
enableMerchantFees(); 