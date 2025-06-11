import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import idl from "../src/utils/gotsol.json";
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROGRAM_ID = new PublicKey(idl.address);
const MERCHANT_PUBKEY = new PublicKey("AUeaPvu9h3a2EY4dEgcghLu5MuzA74DVKRh6GYSsFiuQ");
const AUTH_PUBKEY = new PublicKey("Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih");

async function setMerchantStatus() {
  try {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load the local CLI wallet
    const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
      console.error("❌ Local Solana CLI wallet not found at:", walletPath);
      console.log("Run: solana config get");
      console.log("Make sure your CLI wallet is configured");
      return;
    }

    const secretKeyString = fs.readFileSync(walletPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const payer = Keypair.fromSecretKey(secretKey);
    
    console.log("🔑 Using CLI wallet:", payer.publicKey.toString());
    
    // Check if this wallet matches the AUTH key
    if (!payer.publicKey.equals(AUTH_PUBKEY)) {
      console.error("❌ CLI wallet does not match AUTH key!");
      console.log("CLI wallet:", payer.publicKey.toString());
      console.log("Required AUTH:", AUTH_PUBKEY.toString());
      console.log("Only the AUTH wallet can change merchant status");
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
    
    console.log("📋 Program ID:", PROGRAM_ID.toString());
    console.log("🏪 Merchant:", MERCHANT_PUBKEY.toString());
    console.log("🔐 Auth:", payer.publicKey.toString());
    
    // Check current merchant status
    try {
      const merchantAccount = await program.account.merchant.fetch(MERCHANT_PUBKEY);
      console.log("\n📊 Current Merchant Status:");
      console.log("- Owner:", merchantAccount.owner.toString());
      console.log("- Entity Name:", merchantAccount.entityName);
      console.log("- Fee Eligible:", merchantAccount.feeEligible);
      console.log("- Total Withdrawn:", merchantAccount.totalWithdrawn.toString());
      console.log("- Total Refunded:", merchantAccount.totalRefunded.toString());
      
      if (merchantAccount.feeEligible) {
        console.log("\n✅ Merchant is already fee eligible (true)");
        return;
      }
      
    } catch (error) {
      console.error("❌ Failed to fetch merchant account:", error);
      console.log("Make sure the merchant pubkey is correct and the account exists");
      return;
    }
    
    console.log("\n🔄 Setting fee_eligible to true...");
    
    // Call the set_merchant_status instruction
    const tx = await program.methods
      .setMerchantStatus(true) // Set fee_eligible to true
      .accountsPartial({
        auth: payer.publicKey,      // AUTH wallet (signer)
        merchant: MERCHANT_PUBKEY,  // Target merchant account
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Transaction successful!");
    console.log("📜 Transaction signature:", tx);
    console.log("🔗 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    // Verify the change
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for confirmation
    
    const updatedMerchant = await program.account.merchant.fetch(MERCHANT_PUBKEY);
    console.log("\n📊 Updated Merchant Status:");
    console.log("- Fee Eligible:", updatedMerchant.feeEligible);
    
    if (updatedMerchant.feeEligible) {
      console.log("🎉 Successfully set merchant fee_eligible to true!");
    } else {
      console.log("⚠️  Warning: fee_eligible is still false");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error);
    
    if (error.message?.includes('UnauthorizedStatusChange')) {
      console.log("\n💡 This error means your wallet is not authorized to change merchant status");
      console.log("Only the AUTH wallet can call this instruction");
    }
  }
}

// Run the script
setMerchantStatus(); 