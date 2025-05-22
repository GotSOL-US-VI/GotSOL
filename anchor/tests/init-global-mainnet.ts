import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Kumbaya } from "../target/types/kumbaya";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";

// associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,

///////////////////////////////////////////////////////
//////* THIS SCRIPT IS SET UP FOR MAIN NET !!!!!*//////
///////////////////////////////////////////////////////


describe("kumbaya", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Kumbaya as Program<Kumbaya>;

  // The expected house public key from the program
  const HOUSE = new PublicKey("Hth4EBxLWJSoRWj7raCKoniuzcvXt8MUFgGKty3B66ih");

  // main net USDC address
  const USDC_MAINNET_MINT = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );

  const [global] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );
  console.log("Global account: ", global.toBase58());

  it("should initialize global state", async () => {
    // Get the merchant's USDC ATA address (TO MOCK USDC ON LOCALNET)
    const [houseUsdcAta] = web3.PublicKey.findProgramAddressSync(
      [HOUSE.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_MAINNET_MINT.toBuffer()],
      anchor.utils.token.ASSOCIATED_PROGRAM_ID
    );


  });
});
