export const env = {
  heliusRpcUrl: process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com',
  isDevnet: true, // Always use devnet for now
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID || 'RKAxBK5mBxYta3FUfMLHafMj8xakd8PLsH3PXFa773r',
} as const; 