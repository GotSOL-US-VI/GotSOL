'use client';

import { Connection } from '@solana/web3.js';
import { ConnectionContext } from '@/lib/connection-context';
import { useMemo } from 'react';
import { env } from '@/utils/env';
import { ParaProvider } from '@/components/para/para-provider';

export default function OwnerYieldLayout({ children }: { children: React.ReactNode }) {
  // Use mainnet Helius RPC URL for swap components
  const connection = useMemo(() => new Connection(env.mainnetHeliusRpcUrl, "confirmed"), []);

  return (
    <ConnectionContext.Provider value={{ connection }}>
      <ParaProvider>
        {children}
      </ParaProvider>
    </ConnectionContext.Provider>
  );
} 