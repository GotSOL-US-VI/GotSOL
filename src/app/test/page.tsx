'use client';

import { useEffect, useState } from 'react';
import { Program, Idl, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { useAnchorProvider } from '@/components/para/para-provider';
import { TestTransactionButton } from '@/components/test-transaction-button';
import { usePara } from '@/components/para/para-provider';

export default function TestPage() {
  const [program, setProgram] = useState<Program<Idl> | null>(null);
  const { connection } = useConnection();
  const anchorProvider = useAnchorProvider();
  const { isConnected } = usePara();

  useEffect(() => {
    if (connection && anchorProvider) {
      // Create a simple program for testing
      const testProgram = new Program(
        {
          version: '0.1.0',
          name: 'test_program',
          instructions: [],
          accounts: [],
          types: [],
          events: [],
          errors: [],
          metadata: {},
        },
        new PublicKey('11111111111111111111111111111111'), // Dummy program ID
        anchorProvider
      );
      
      setProgram(testProgram);
    }
  }, [connection, anchorProvider]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Transaction Signing Test</h1>
      
      {!isConnected ? (
        <div className="alert alert-warning">
          <span>Please connect your wallet to test transaction signing</span>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm opacity-70">
            This page tests the transaction signing flow with the fee payer. 
            Click the button below to send a test transaction.
          </p>
          
          {program ? (
            <TestTransactionButton program={program} />
          ) : (
            <div className="alert alert-info">
              <span>Loading program...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 