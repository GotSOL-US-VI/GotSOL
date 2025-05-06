import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import KumbayaIDL from './kumbaya.json'

// Define the Kumbaya type from the IDL
export type Kumbaya = Idl & typeof KumbayaIDL

// Re-export the IDL
export { default as KumbayaIDL } from './kumbaya.json'

// The programId is imported from the program IDL
export const KUMBAYA_PROGRAM_ID = new PublicKey(KumbayaIDL.address)

// Helper function to get the Kumbaya program instance
export function getKumbayaProgram(provider: AnchorProvider): Program<Kumbaya> {
  return new Program(KumbayaIDL as Kumbaya, provider)
} 