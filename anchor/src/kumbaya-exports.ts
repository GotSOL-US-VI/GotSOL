// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import KumbayaIDL from '../target/idl/kumbaya.json'
import type { Kumbaya } from '../target/types/kumbaya'

// Re-export the generated IDL and type
export { Kumbaya, KumbayaIDL }

// The programId is imported from the program IDL.
export const KUMBAYA_PROGRAM_ID = new PublicKey(KumbayaIDL.address)

// This is a helper function to get the Kumbaya Anchor program.
export function getKumbayaProgram(provider: AnchorProvider) {
  return new Program(KumbayaIDL as Kumbaya, provider)
}