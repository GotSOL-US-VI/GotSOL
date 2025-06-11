// Extended wallet interface with additional Para properties
export interface ExtendedWallet {
  address?: string;
  id?: string;
  email?: string;
  // Add other properties as needed
}

// Type guard to safely access wallet email
export function hasEmail(wallet: any): wallet is ExtendedWallet & { email: string } {
  return wallet && typeof wallet.email === 'string';
}

// Type guard to safely access wallet ID
export function hasWalletId(wallet: any): wallet is ExtendedWallet & { id: string } {
  return wallet && typeof wallet.id === 'string';
}

// Safe wallet email getter
export function getWalletEmail(wallet: any): string | null {
  return hasEmail(wallet) ? wallet.email : null;
}

// Safe wallet ID getter  
export function getWalletId(wallet: any): string | null {
  return hasWalletId(wallet) ? wallet.id : null;
}

// Safe wallet transaction sender type
export interface WalletTransactionSender {
  sendTransaction: (transaction: any) => Promise<string>;
}

// Type guard for transaction sending capability
export function canSendTransaction(wallet: any): wallet is WalletTransactionSender {
  return wallet && typeof wallet.sendTransaction === 'function';
} 