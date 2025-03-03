export const env = {
  heliusRpcUrl: process.env.NEXT_PUBLIC_HELIUS_RPC_URL,
  isDevnet: process.env.NEXT_PUBLIC_CLUSTER === 'devnet' || true,
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID || 'RKAxBK5mBxYta3FUfMLHafMj8xakd8PLsH3PXFa773r',
} as const;

// Validate required environment variables
if (!env.heliusRpcUrl) {
  throw new Error('NEXT_PUBLIC_HELIUS_RPC_URL is required');
} 