import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Kumbaya } from "../target/types/kumbaya";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";

// associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,

///////////////////////////////////////////////////////
/* THIS SCRIPT IS SET UP FOR DEVNET NOT MAIN NET !!!!*/
///////////////////////////////////////////////////////


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


  const [global] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );
  console.log("Global account: ", global.toBase58());

  it("should initialize global state", async () => {
    // Get the merchant's USDC ATA address (TO MOCK USDC ON LOCALNET)
    const [houseUsdcAta] = web3.PublicKey.findProgramAddressSync(
      [HOUSE.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_DEVNET_MINT.toBuffer()],
      anchor.utils.token.ASSOCIATED_PROGRAM_ID
    );

    try {
      // Execute the init_global instruction
      const tx = await program.methods
        .initGlobal()
        .accountsPartial({
          house: HOUSE,
          global,
          usdcMint: USDC_DEVNET_MINT,
          houseUsdcAta: houseUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Transaction signature:", tx);

      // Fetch the created account
      const globalAccount = await program.account.global.fetch(global);

      // Verify the account data
      assert.ok(
        globalAccount.house.equals(HOUSE),
        "House address should match"
      );
      assert.ok(globalAccount.globalBump > 0, "Bump should be set");
      console.log(
        "global bump in global state account: ",
        globalAccount.globalBump
      );
      console.log(
        "HOUSE address in global state account: ",
        globalAccount.house.toString()
      );
      console.log("HOUSE USDC ATA Address: ", houseUsdcAta.toString());
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
});
