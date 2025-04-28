"use client";
import { Connection } from '@solana/web3.js';
import { ConnectionContext } from './connection-context';
import React, { useMemo } from 'react';
import { env } from '@/utils/env';

export function MainnetConnectionProvider({ children }: { children: React.ReactNode }) {
  // Use the mainnet Helius RPC URL for mainnet operations
  const connection = useMemo(() => new Connection(env.mainnetHeliusRpcUrl, "confirmed"), []);

  return (
    <ConnectionContext.Provider value={{ connection }}>
      {children}
    </ConnectionContext.Provider>
  );
} 