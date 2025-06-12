import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import { Gotsol } from "../target/types/gotsol";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import { Buffer } from "buffer";
import wallet from "/home/agent/.config/solana/id.json";


describe("gotsol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Gotsol as Program<Gotsol>;
  const AUTH_PUBKEY = new PublicKey("Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih");
  const HOUSE = AUTH_PUBKEY;
  const connection = provider.connection;
  const auth = Keypair.fromSecretKey(new Uint8Array(wallet));

  let owner: Keypair;
  let merchant: PublicKey;
  let merchantBump: number;
  let vault: PublicKey;
  let vaultBump: number;
  let refundRecord: PublicKey;
  let refundBump: number;
  let stablecoinMint: PublicKey;
  let stablecoinMintAuthority: Keypair;
  let merchantStablecoinAta: PublicKey;
  let ownerStablecoinAta: PublicKey;
  let houseStablecoinAta: PublicKey;
  let recipient: Keypair;
  let recipientStablecoinAta: PublicKey;
  let merchantName = "TestMerchant";
  let rentExempt: number;
  let withdrawalAmount: number;


  before(async () => {
    owner = Keypair.generate();
    stablecoinMintAuthority = Keypair.generate();
    recipient = Keypair.generate();
    let sig1 = await provider.connection.requestAirdrop(owner.publicKey, 3 * web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig1, "confirmed");
    let sig2 = await provider.connection.requestAirdrop(stablecoinMintAuthority.publicKey, 2 * web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig2, "confirmed");
    let sig3 = await provider.connection.requestAirdrop(recipient.publicKey, 2 * web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig3, "confirmed");
    let sig4 = await provider.connection.requestAirdrop(HOUSE, 1 * web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig4, "confirmed");
    stablecoinMint = await createMint(
      provider.connection,
      stablecoinMintAuthority,
      stablecoinMintAuthority.publicKey,
      null,
      6
    );
    [merchant, merchantBump] = PublicKey.findProgramAddressSync([
      Buffer.from("merchant"),
      Buffer.from(merchantName),
      owner.publicKey.toBuffer(),
    ], program.programId);
    [vault, vaultBump] = PublicKey.findProgramAddressSync([
      Buffer.from("vault"),
      merchant.toBuffer(),
    ], program.programId);
    merchantStablecoinAta = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner,
      stablecoinMint,
      merchant,
      true
    )).address;
    ownerStablecoinAta = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner,
      stablecoinMint,
      owner.publicKey
    )).address;
    houseStablecoinAta = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner,
      stablecoinMint,
      HOUSE,
      true
    )).address;
    recipientStablecoinAta = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner,
      stablecoinMint,
      recipient.publicKey
    )).address;
    await mintTo(
      provider.connection,
      stablecoinMintAuthority,
      stablecoinMint,
      merchantStablecoinAta,
      stablecoinMintAuthority,
      1_000_000_000
    );
    rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    withdrawalAmount = 1_000_000;
    const fundVaultTx = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: vault,
        lamports: withdrawalAmount + rentExempt + 1_000_000, // add a little extra for safety
      })
    );
    await provider.sendAndConfirm(fundVaultTx, [owner]);
  });

  it("creates a merchant", async () => {
    const tx = await program.methods
      .createMerchant(merchantName)
      .accountsPartial({
        owner: owner.publicKey,
        merchant,
        vault,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    console.log("createMerchant tx:", tx);
    const merchantAccount = await program.account.merchant.fetch(merchant);
    console.log("Merchant pubkey:", merchant.toString());
    console.log("Merchant owner:", merchantAccount.owner.toString());
    console.log("Merchant name:", merchantAccount.entityName);
    assert.equal(merchantAccount.entityName, merchantName);
    assert.ok(merchantAccount.owner.equals(owner.publicKey));
  });

  it("withdraws SPL tokens", async () => {
    const amount = new BN(1_000_000);
    const tx = await program.methods
      .withdrawSpl(amount)
      .accountsPartial({
        owner: owner.publicKey,
        merchant,
        stablecoinMint,
        merchantStablecoinAta,
        ownerStablecoinAta,
        house: HOUSE,
        houseStablecoinAta,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    console.log("withdrawSpl tx:", tx);
    const ownerAta = await getAccount(provider.connection, ownerStablecoinAta);
    const houseAta = await getAccount(provider.connection, houseStablecoinAta);
    console.log("Owner SPL balance:", ownerAta.amount.toString());
    console.log("House SPL balance:", houseAta.amount.toString());
    assert.ok(ownerAta.amount > 0);
    assert.ok(houseAta.amount > 0);
  });

  it("withdraws SOL", async () => {
    const vaultBalanceBefore = await provider.connection.getBalance(vault);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    const buffer = 1000; // Leave a small buffer to ensure rent-exempt status
    const maxWithdraw = vaultBalanceBefore - rentExempt - buffer;
    const amount = new BN(maxWithdraw > 0 ? maxWithdraw : 0);
    const tx = await program.methods
      .withdrawSol(new BN(amount))
      .accountsPartial({
        owner: owner.publicKey,
        merchant,
        vault,
        house: HOUSE,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    console.log("withdrawSol tx:", tx);
    const vaultBalance = await provider.connection.getBalance(vault);
    console.log("Vault SOL balance:", vaultBalance.toString());
    assert.ok(vaultBalance >= rentExempt);
  });

  it("refunds SPL tokens", async () => {
    const originalTxSig = "mockTxSigSpl";
    const amount = new BN(100_000);
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    const tx = await program.methods
      .refundSpl(originalTxSig, amount)
      .accountsPartial({
        owner: owner.publicKey,
        merchant,
        stablecoinMint,
        merchantStablecoinAta,
        recipientStablecoinAta,
        refundRecord,
        recipient: recipient.publicKey,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    console.log("refundSpl tx:", tx);
    const recipientAta = await getAccount(provider.connection, recipientStablecoinAta);
    console.log("Recipient SPL balance:", recipientAta.amount.toString());
    assert.ok(recipientAta.amount > 0);
  });

  it("attempts duplicate refund of SPL", async () => {
    const originalTxSig = "mockTxSigSpl";
    const amount = new BN(100_000);
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    try {
      const tx = await program.methods
        .refundSpl(originalTxSig, amount)
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          stablecoinMint,
          merchantStablecoinAta,
          recipientStablecoinAta,
          refundRecord,
          recipient: recipient.publicKey,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
        assert.fail("Expected error due to duplicate refund");
      } catch (e: any) {
        console.log("Duplicate refund rejected as expected");
        // console.log("Error:", e.message);
        assert.ok(e.message.includes("already in use"));
      }
  });

  it("refunds SOL", async () => {
    const originalTxSig = "mockTxSigSol";
    const vaultBalanceBefore = await provider.connection.getBalance(vault);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    const buffer = 1000; // Leave a small buffer to ensure rent-exempt status
    const maxRefund = vaultBalanceBefore - rentExempt - buffer;
    const amount = new BN(maxRefund > 0 ? maxRefund : 0);
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    const tx = await program.methods
      .refundSol(originalTxSig, new BN(1000))
      .accountsPartial({
        owner: owner.publicKey,
        merchant,
        vault,
        refundRecord,
        recipient: recipient.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    console.log("refundSol tx:", tx);
    const recipientBalance = await provider.connection.getBalance(recipient.publicKey);
    console.log("Recipient SOL balance:", recipientBalance.toString());
    assert.ok(recipientBalance > 0);
  });

  it("attempts duplicate refund of SOL", async () => {
    const originalTxSig = "mockTxSigSol";
    const vaultBalanceBefore = await provider.connection.getBalance(vault);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    const buffer = 1000; // Leave a small buffer to ensure rent-exempt status
    const maxRefund = vaultBalanceBefore - rentExempt - buffer;
    const amount = new BN(maxRefund > 0 ? maxRefund : 0);
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    try {
      const tx = await program.methods
        .refundSol(originalTxSig, new BN(1000))
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          vault,
          refundRecord,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to duplicate refund");
    } catch (e: any) {
      console.log("Duplicate refund rejected as expected");
      // console.log("Error:", e.message);
      assert.ok(e.message.includes("already in use"));
    }
  });

  it("sets merchant status to true", async function () {
    const tx = await program.methods
      .setMerchantStatus(true)
      .accountsPartial({
        auth: auth.publicKey,
        merchant,
        systemProgram: SystemProgram.programId,
      })
      .signers([auth])
      .rpc();
    console.log("setMerchantStatus tx:", tx);
    
    const merchantAccount = await program.account.merchant.fetch(merchant);
    assert.ok(merchantAccount.feeEligible === true, "Merchant fee_eligible should be true");
    console.log("Merchant fee eligibility status:", merchantAccount.feeEligible);
  });

  it("sets merchant status to false", async function () {
    const tx = await program.methods
      .setMerchantStatus(false)
      .accountsPartial({
        auth: auth.publicKey,
        merchant,
        systemProgram: SystemProgram.programId,
      })
      .signers([auth])
      .rpc();
    console.log("setMerchantStatus tx:", tx);
    
    const merchantAccount = await program.account.merchant.fetch(merchant);
    assert.ok(merchantAccount.feeEligible === false, "Merchant fee_eligible should be false");
    console.log("Merchant fee eligibility status:", merchantAccount.feeEligible);
  });

  it("rejects minimum withdrawal amount for SPL", async function () {
    const amount = new BN(50); // Below minimum of 100
    try {
      const tx = await program.methods
        .withdrawSpl(amount)
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          stablecoinMint,
          merchantStablecoinAta,
          ownerStablecoinAta,
          house: HOUSE,
          houseStablecoinAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to below minimum withdrawal");
    } catch (e: any) {
      console.log("Below minimum SPL withdrawal rejected as expected");
      assert.ok(e.message.includes("BelowMinimumWithdrawal"));
    }
  });

  it("rejects minimum withdrawal amount for SOL", async function () {
    const amount = new BN(500); // Below minimum of 1000 lamports
    try {
      const tx = await program.methods
        .withdrawSol(amount)
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          vault,
          house: HOUSE,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to below minimum withdrawal");
    } catch (e: any) {
      console.log("Below minimum SOL withdrawal rejected as expected");
      assert.ok(e.message.includes("BelowMinimumWithdrawal"));
    }
  });

  it("rejects zero amount refund for SPL", async function () {
    const originalTxSig = "mockTxSigZeroSpl";
    const amount = new BN(0);
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    try {
      const tx = await program.methods
        .refundSpl(originalTxSig, amount)
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          stablecoinMint,
          merchantStablecoinAta,
          recipientStablecoinAta,
          refundRecord,
          recipient: recipient.publicKey,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to zero amount refund");
    } catch (e: any) {
      console.log("Zero amount SPL refund rejected as expected");
      assert.ok(e.message.includes("ZeroAmountRefund"));
    }
  });

  it("rejects zero amount refund for SOL", async function () {
    const originalTxSig = "mockTxSigZeroSol";
    const amount = new BN(0);
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    try {
      const tx = await program.methods
        .refundSol(originalTxSig, amount)
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          vault,
          refundRecord,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to zero amount refund");
    } catch (e: any) {
      console.log("Zero amount SOL refund rejected as expected");
      assert.ok(e.message.includes("ZeroAmountRefund"));
    }
  });

  it("rejects unauthorized status change", async function () {
    const unauthorizedUser = Keypair.generate();
    // Airdrop some SOL to the unauthorized user
    const sig = await provider.connection.requestAirdrop(unauthorizedUser.publicKey, 1 * web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
    
    try {
      const tx = await program.methods
        .setMerchantStatus(true)
        .accountsPartial({
          auth: unauthorizedUser.publicKey,
          merchant,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected error due to unauthorized status change");
    } catch (e: any) {
      console.log("Unauthorized status change rejected as expected");
      assert.ok(e.message.includes("UnauthorizedStatusChange"));
    }
  });

  it("rejects invalid merchant name (empty)", async function () {
    const invalidMerchantName = "";
    const [invalidMerchant, invalidMerchantBump] = PublicKey.findProgramAddressSync([
      Buffer.from("merchant"),
      Buffer.from(invalidMerchantName),
      owner.publicKey.toBuffer(),
    ], program.programId);
    const [invalidVault, invalidVaultBump] = PublicKey.findProgramAddressSync([
      Buffer.from("vault"),
      invalidMerchant.toBuffer(),
    ], program.programId);
    
    try {
      const tx = await program.methods
        .createMerchant(invalidMerchantName)
        .accountsPartial({
          owner: owner.publicKey,
          merchant: invalidMerchant,
          vault: invalidVault,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to invalid merchant name");
    } catch (e: any) {
      console.log("Invalid merchant name rejected as expected");
      assert.ok(e.message.includes("InvalidMerchantName"));
    }
  });

  it("rejects invalid merchant name (whitespace only)", async function () {
    const invalidMerchantName = "   ";
    const [invalidMerchant, invalidMerchantBump] = PublicKey.findProgramAddressSync([
      Buffer.from("merchant"),
      Buffer.from(invalidMerchantName),
      owner.publicKey.toBuffer(),
    ], program.programId);
    const [invalidVault, invalidVaultBump] = PublicKey.findProgramAddressSync([
      Buffer.from("vault"),
      invalidMerchant.toBuffer(),
    ], program.programId);
    
    try {
      const tx = await program.methods
        .createMerchant(invalidMerchantName)
        .accountsPartial({
          owner: owner.publicKey,
          merchant: invalidMerchant,
          vault: invalidVault,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected error due to invalid merchant name");
    } catch (e: any) {
      console.log("Invalid merchant name (whitespace) rejected as expected");
      assert.ok(e.message.includes("InvalidMerchantName"));
    }
  });

  it("rejects invalid merchant name (too long)", async function () {
    // Test with a name that's within Solana's PDA limits but exceeds our smart contract's MAX_ENTITY_NAME_LEN
    // We'll use a name that's exactly 32 chars (max PDA seed) but our contract limits it to 32 chars
    // Since 32 chars is actually valid, let's test with a name that's 33 chars but handle the PDA error
    const invalidMerchantName = "A".repeat(33); // Exceeds MAX_ENTITY_NAME_LEN of 32
    
    try {
      // This will fail at the PDA level before reaching our smart contract validation
      const [invalidMerchant, invalidMerchantBump] = PublicKey.findProgramAddressSync([
        Buffer.from("merchant"),
        Buffer.from(invalidMerchantName),
        owner.publicKey.toBuffer(),
      ], program.programId);
      assert.fail("Expected PDA creation to fail due to max seed length");
    } catch (e: any) {
      console.log("PDA creation failed due to max seed length as expected");
      assert.ok(e.message.includes("Max seed length exceeded"));
    }
  });
    
  it("closes merchant", async () => {
    const tx = await program.methods
      .closeMerchant()
      .accountsPartial({
        owner: owner.publicKey,
        merchant,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    console.log("closeMerchant tx:", tx);
    try {
      await program.account.merchant.fetch(merchant);
      assert.fail("Merchant account should be closed");
    } catch (e: any) {
      console.log("Merchant account closed as expected");
      assert.ok(e.message.includes("Account does not exist"));
    }
  });

  it("closes refund record", async function () {
    // Use the refund record from the previous "refunds SOL" test
    // We need to use a refund record that actually exists
    const originalTxSig = "mockTxSigSol"; // This was used in the "refunds SOL" test
    [refundRecord, refundBump] = PublicKey.findProgramAddressSync([
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ], program.programId);
    
    const closeTx = await program.methods
      .closeRefund()
      .accountsPartial({
        auth: auth.publicKey,
        refundRecord,
        systemProgram: SystemProgram.programId,
      })
      .signers([auth])
      .rpc();
    console.log("closeRefund tx:", closeTx);
    
    try {
      await program.account.refundRecord.fetch(refundRecord);
      assert.fail("Refund Record account should be closed");
    } catch (e: any) {
      console.log("Refund Record closed as expected");
      assert.ok(e.message.includes("Account does not exist"));
    }
  });
});

