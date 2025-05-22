import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Kumbaya } from "../target/types/kumbaya";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";

// associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,

describe("kumbaya", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Kumbaya as Program<Kumbaya>;

  // The expected house public key from the program
  const HOUSE = new PublicKey("Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih");

  // main net USDC address
  const USDC_MINT = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );

  // devnet USDC address
  const USDC_DEVNET_MINT = new PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  );

  // Create a mock USDC mint authority
  const mockUsdcMintAuthority = web3.Keypair.generate();
  let mockUsdcMint: PublicKey;

  const [global] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );
  console.log("Global account: ", global.toBase58());

  before(async () => {
    // Airdrop SOL to mint authority for creating the mint
    const signature = await provider.connection.requestAirdrop(
      mockUsdcMintAuthority.publicKey,
      2 * web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create the mock USDC mint
    mockUsdcMint = await createMint(
      provider.connection,
      mockUsdcMintAuthority,
      mockUsdcMintAuthority.publicKey,
      mockUsdcMintAuthority.publicKey,
      6 // USDC has 6 decimals
    );
    console.log("Mock USDC mint created:", mockUsdcMint.toString());
  });

  it("should initialize global state", async () => {
    // Get the merchant's USDC ATA address (TO MOCK USDC ON LOCALNET)
    const [houseMockUsdcAta] = web3.PublicKey.findProgramAddressSync(
      [HOUSE.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mockUsdcMint.toBuffer()],
      anchor.utils.token.ASSOCIATED_PROGRAM_ID
    );

  });

  it("Initializes a Merchant called The Remedy", async () => {
    const owner = web3.Keypair.generate();
    console.log("New owner pubkey: ", owner.publicKey.toString());
    const merchantName = "The Remedy";

    const [merchant] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("merchant"),
        Buffer.from(merchantName),
        owner.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Get the merchant's USDC ATA address (FOR DEVNET FOR TESTING)
    // const [merchantUsdcAta] = web3.PublicKey.findProgramAddressSync(
    //   [
    //     merchant.toBuffer(),
    //     TOKEN_PROGRAM_ID.toBuffer(),
    //     USDC_DEVNET_MINT.toBuffer(),
    //   ],
    //   anchor.utils.token.ASSOCIATED_PROGRAM_ID
    // );

    // Get the merchant's USDC ATA address (TO MOCK USDC ON LOCALNET)
    const [merchantMockUsdcAta] = web3.PublicKey.findProgramAddressSync(
      [
        merchant.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mockUsdcMint.toBuffer(),
      ],
      anchor.utils.token.ASSOCIATED_PROGRAM_ID
    );

    // Airdrop 2 SOL to the owner
    const signature = await provider.connection.requestAirdrop(
      owner.publicKey,
      2 * web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    try {
      const tx = await program.methods
        .createMerchant(merchantName)
        .accountsPartial({
          owner: owner.publicKey,
          merchant,
          usdcMint: mockUsdcMint,
          merchantUsdcAta: merchantMockUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      console.log("Transaction signature:", tx);

      // Fetch and verify the merchant account
      const merchantAccount = await program.account.merchant.fetch(merchant);
      console.log("Merchant pubkey: ", merchant.toString());
      console.log(
        "Owner address from merchant state account: ",
        merchantAccount.owner.toString()
      );
      console.log(
        "Merchant's entity_name from merchant state account: ",
        merchantAccount.entityName.toString()
      );
      console.log(
        "Merchant bump from merchant state account: ",
        merchantAccount.merchantBump
      );
      assert.equal(
        merchantAccount.entityName,
        merchantName,
        "Merchant name should match"
      );
      assert.ok(
        merchantAccount.owner.equals(owner.publicKey),
        "Owner should match"
      );
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
});
