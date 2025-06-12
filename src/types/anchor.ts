import { Program, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { Gotsol } from '@/utils/gotsol-exports';

export type { Gotsol };

// Define proper merchant account structure
export interface MerchantAccount {
  owner: PublicKey;
  entityName: string;
  merchantBump: number;
  active: boolean;
  feeEligible: boolean;
  // Add other fields as needed based on your Anchor program
}

// Define proper program account interface
export interface GotsolProgramAccounts {
  merchant: {
    fetch: (address: PublicKey) => Promise<MerchantAccount>;
    // Add other account methods as needed
  };
}

// Type-safe program interface
export interface TypedGotsolProgram extends Omit<Program<Gotsol>, 'account'> {
  account: GotsolProgramAccounts;
}

// Type guard to safely convert Program to TypedGotsolProgram
export function asTypedProgram(program: Program<Gotsol>): TypedGotsolProgram {
  return program as unknown as TypedGotsolProgram;
}

// Safe merchant fetch utility
export async function fetchMerchantAccount(
  program: Program<Gotsol>, 
  merchantPubkey: PublicKey
): Promise<MerchantAccount> {
  try {
    const typedProgram = asTypedProgram(program);
    return await typedProgram.account.merchant.fetch(merchantPubkey);
  } catch (error) {
    console.error('Error fetching merchant account:', error);
    throw new Error(`Failed to fetch merchant account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 