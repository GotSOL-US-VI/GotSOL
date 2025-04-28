'use client';

import { useState } from 'react';
import { Program, Idl } from '@coral-xyz/anchor';
import { testTransactionSigning } from '@/utils/test-transaction';
import { usePara } from './para/para-provider';
import { PublicKey } from '@solana/web3.js';

interface TestTransactionButtonProps {
  program: Program<Idl>;
}

export function TestTransactionButton({ program }: TestTransactionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const { isConnected, address, signer } = usePara();

  const handleTestTransaction = async () => {
    if (!isConnected || !address || !signer) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSignature(null);

      console.log('Testing transaction signing...');
      const txSignature = await testTransactionSigning(
        program,
        new PublicKey(address),
        signer
      );
      
      console.log('Transaction test completed successfully');
      setSignature(txSignature);
    } catch (err) {
      console.error('Error testing transaction:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Test Transaction Signing</h2>
      
      <button
        onClick={handleTestTransaction}
        disabled={!isConnected || isLoading}
        className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
      >
        {isLoading ? 'Testing...' : 'Test Transaction Signing'}
      </button>
      
      {!isConnected && (
        <p className="text-sm text-red-500 mt-2">
          Please connect your wallet to test transaction signing
        </p>
      )}
      
      {error && (
        <div className="alert alert-error mt-4">
          <span>{error}</span>
        </div>
      )}
      
      {signature && (
        <div className="alert alert-success mt-4">
          <span>Transaction successful! Signature: {signature.substring(0, 8)}...{signature.substring(signature.length - 8)}</span>
        </div>
      )}
    </div>
  );
} 