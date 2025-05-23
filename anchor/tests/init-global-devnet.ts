import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Gotsol } from "../target/types/gotsol";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,

///////////////////////////////////////////////////////
/* THIS SCRIPT IS SET UP FOR DEVNET NOT MAIN NET !!!!*/
///////////////////////////////////////////////////////


describe("gotsol", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Gotsol as Program<Gotsol>;

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


  const [global] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );
  console.log("Global account: ", global.toBase58());

  it("should initialize global state", async () => {
    // Get the merchant's USDC ATA address (TO MOCK USDC ON LOCALNET)
    const [houseUsdcAta] = anchor.web3.PublicKey.findProgramAddressSync(
      [HOUSE.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_DEVNET_MINT.toBuffer()],
      anchor.utils.token.ASSOCIATED_PROGRAM_ID
    );




  });
});
