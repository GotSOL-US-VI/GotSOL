export const USDC_MINT = {
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export const env = {
  devnetHeliusRpcUrl: process.env.NEXT_PUBLIC_HELIUS_RPC_URL!,
  mainnetHeliusRpcUrl: process.env.NEXT_PUBLIC_MAINNET_HELIUS_RPC_URL!,
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID!,
  productionUrl: process.env.NEXT_PUBLIC_PRODUCTION_URL || 'https://gotsol-opal.vercel.app',
  isDevnet: process.env.NEXT_PUBLIC_HELIUS_RPC_URL?.includes('devnet') ?? false,
  get usdcMint() {
    return this.isDevnet ? USDC_MINT.devnet : USDC_MINT.mainnet;
  },
} as const; 