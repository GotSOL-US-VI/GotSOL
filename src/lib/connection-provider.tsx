"use client";
import { Connection } from '@solana/web3.js';
import { ConnectionContext } from './connection-context'; // adjust import path
import React, { useMemo } from 'react';
import { env } from '@/utils/env';

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  // Use devnet Helius RPC URL for merchant components
  const connection = useMemo(() => new Connection(env.heliusRpcUrl, "confirmed"), []);

  return (
    <ConnectionContext.Provider value={{ connection }}>
      {children}
    </ConnectionContext.Provider>
  );
}