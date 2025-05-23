// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import GotsolIDL from '../target/idl/gotsol.json'
import type { Gotsol } from '../target/types/gotsol'

// Re-export the generated IDL and type
export { Gotsol, GotsolIDL }

// The programId is imported from the program IDL.
export const GOTSOL_PROGRAM_ID = new PublicKey(GotsolIDL.address)

// This is a helper function to get the Gotsol Anchor program.
export function getGotsolProgram(provider: AnchorProvider) {
  return new Program(GotsolIDL as Gotsol, provider)
}