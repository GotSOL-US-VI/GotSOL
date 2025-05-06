import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import KumbayaIDL from './kumbaya.json'
import type { Kumbaya } from '../../anchor/target/types/kumbaya'

// Re-export the type and IDL
export type { Kumbaya }
export { default as KumbayaIDL } from './kumbaya.json'

// The programId is imported from the program IDL
export const KUMBAYA_PROGRAM_ID = new PublicKey(KumbayaIDL.address)

// Helper function to get the Kumbaya program instance
export function getKumbayaProgram(provider: AnchorProvider): Program<Kumbaya> {
  return new Program(KumbayaIDL as Kumbaya, provider)
} 