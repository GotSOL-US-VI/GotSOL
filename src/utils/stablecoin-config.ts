import { PublicKey } from '@solana/web3.js';

export interface StablecoinConfig {
  symbol: string;
  name: string;
  decimals: number;
  mainnetMint: PublicKey;
  devnetMint: PublicKey;
  icon?: string;
  isNative?: boolean; // Special flag for SOL
}

// Stablecoin configurations
export const STABLECOINS: Record<string, StablecoinConfig> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    mainnetMint: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL mint
    devnetMint: new PublicKey('So11111111111111111111111111111111111111112'),
    icon: '◎',
    isNative: true
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    mainnetMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    devnetMint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    icon: '💵'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    mainnetMint: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
    devnetMint: new PublicKey('EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS'), // Example devnet USDT
    icon: '🟢'
  },
  PYUSD: {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    decimals: 6,
    mainnetMint: new PublicKey('2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'),
    devnetMint: new PublicKey('CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM'), // Example devnet PYUSD
    icon: '🔵'
  }
};

export function getStablecoinMint(symbol: string, isDevnet: boolean): PublicKey {
  const config = STABLECOINS[symbol.toUpperCase()];
  if (!config) {
    throw new Error(`Unsupported stablecoin: ${symbol}`);
  }
  return isDevnet ? config.devnetMint : config.mainnetMint;
}

export function getStablecoinDecimals(symbol: string): number {
  const config = STABLECOINS[symbol.toUpperCase()];
  if (!config) {
    throw new Error(`Unsupported stablecoin: ${symbol}`);
  }
  return config.decimals;
}

export function isNativeToken(symbol: string): boolean {
  const config = STABLECOINS[symbol.toUpperCase()];
  return config?.isNative === true;
}

export function getSupportedStablecoins(): string[] {
  return Object.keys(STABLECOINS);
}

export function isValidStablecoin(symbol: string): boolean {
  return symbol.toUpperCase() in STABLECOINS;
} 