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