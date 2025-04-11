import { createContext, useContext } from 'react';
import { Connection } from '@solana/web3.js';

export interface ConnectionContextState {
  connection: Connection | null;
}

export const ConnectionContext = createContext<ConnectionContextState>({
  connection: null,
});

export function useConnection(): { connection: Connection } {
    const context = useContext(ConnectionContext);
    if (!context.connection) {
      throw new Error('useConnection must be used within a ConnectionProvider and connection must not be null');
    }
    return { connection: context.connection };
  }
