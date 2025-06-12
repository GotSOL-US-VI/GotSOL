import { Program, Idl, AnchorProvider } from '@coral-xyz/anchor'
import GotsolIDL from './gotsol.json'
import { PublicKey } from '@solana/web3.js'

// Define the Gotsol type from the IDL
export type Gotsol = Idl & typeof GotsolIDL

// Export the IDL
export { default as GotsolIDL } from './gotsol.json'

// Export the program ID
export const GOTSOL_PROGRAM_ID = new PublicKey(GotsolIDL.address)

// Helper function to get the Gotsol program instance
export function getGotsolProgram(provider: AnchorProvider): Program<Gotsol> {
  return new Program(GotsolIDL as Gotsol, provider)
}

// PDA derivation utilities
export function findMerchantPda(
  entityName: string,
  owner: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("merchant"),
      Buffer.from(entityName),
      owner.toBuffer(),
    ],
    GOTSOL_PROGRAM_ID
  );
}

export function findVaultPda(
  merchant: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      merchant.toBuffer(),
    ],
    GOTSOL_PROGRAM_ID
  );
}

export function findRefundRecordPda(
  originalTxSig: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("refund"),
      Buffer.from(originalTxSig),
    ],
    GOTSOL_PROGRAM_ID
  );
}

// Convenience function to get vault PDA from merchant entity name and owner
export function findVaultPdaFromMerchantInfo(
  entityName: string,
  owner: PublicKey
): [PublicKey, number] {
  const [merchantPda] = findMerchantPda(entityName, owner);
  return findVaultPda(merchantPda);
} 