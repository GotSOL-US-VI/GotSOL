'use client';

import { useState, useEffect } from 'react';
import { Merchant } from '@/hooks/find-merchants';
import { useWallet, useClient } from '@getpara/react-sdk';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useConnection } from '@/lib/connection-context';
import { getGotsolProgram } from '@/utils/gotsol-exports';
import { useQueryClient } from '@tanstack/react-query';
import { toastUtils } from '@/utils/toast-utils';
import * as anchor from '@coral-xyz/anchor';
import { ParaSolanaWeb3Signer } from '@getpara/solana-web3.js-v1-integration';
import { toParaSignerCompatible } from '@/types/para';

interface DeleteMerchantModalProps {
  merchant: Merchant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteMerchantModal({ merchant, onConfirm, onCancel }: DeleteMerchantModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { data: wallet } = useWallet();
  const para = useClient();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const isConfirmValid = confirmText.toLowerCase() === 'delete';
  const merchantId = merchant.publicKey.toString();
  const merchantName = merchant.account.entityName;

  const handleDelete = async () => {
    if (!isConfirmValid || !wallet?.address || !para || !connection) {
      console.log('Missing requirements:', { 
        isConfirmValid, 
        hasWallet: !!wallet?.address, 
        hasPara: !!para, 
        hasConnection: !!connection 
      });
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      console.log('Starting merchant deletion process...');

      const ownerPubkey = new PublicKey(wallet.address);
      const merchantPubkey = merchant.publicKey;

      console.log('Delete params:', {
        owner: ownerPubkey.toString(),
        merchant: merchantPubkey.toString(),
        merchantName: merchant.account.entityName
      });

      // Create Para Solana signer - use type-safe conversion
      const solanaSigner = new ParaSolanaWeb3Signer(toParaSignerCompatible(para), connection);

      // Create the provider with Para signer
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: ownerPubkey,
          signTransaction: solanaSigner.signTransaction.bind(solanaSigner),
          signAllTransactions: async (txs) => {
            return Promise.all(txs.map(tx => solanaSigner.signTransaction(tx)));
          }
        },
        { commitment: 'confirmed' }
      );

      // Get the program
      const program = getGotsolProgram(provider);

      console.log('Program created, calling closeMerchant...');

      // Call the close_merchant instruction
      const tx = await program.methods
        .closeMerchant()
        .accounts({
          owner: ownerPubkey,
          merchant: merchantPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Merchant closed successfully:', tx);

      // Show success toast
      toastUtils.success(
        <div>
          <p>Merchant &ldquo;{merchantName}&rdquo; deleted successfully!</p>
          <p className="text-xs mt-1">
            <a
              href={`https://solscan.io/tx/${tx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          </p>
        </div>
      );

      // Invalidate and refetch merchants query to update the UI
      await queryClient.invalidateQueries({ queryKey: ['merchants'] });

      // Call the onConfirm callback to close the modal and update state
      onConfirm();

    } catch (err: unknown) {
      console.error('Error deleting merchant:', err);
      
      let errorMessage = 'Failed to delete merchant';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Only trigger deletion if form is valid and not loading
      if (isConfirmValid && !isDeleting) {
        handleDelete();
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking on the backdrop itself, not the modal content
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        
        <div className="py-4">
          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold">This action cannot be undone!</h4>
              <p className="text-sm">This will close the Merchant account and prevent withdrawing from its token accounts!</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <p><span className="font-semibold">Merchant Name:</span> {merchantName}</p>
            <p><span className="font-semibold">Public Key:</span> {merchantId}</p>
          </div>

          <div className="bg-base-200 p-4 rounded-lg mb-4">
            <h4 className="font-semibold mb-2">Important Notes:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All funds should be withdrawn before deletion</li>
              <li>You can recreate a Merchant with the same name later if needed</li>
              <li>Your accounts will be the same if you use the exact same name: <strong>{merchantName}</strong></li>
            </ul>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Type <span className="font-bold text-error">&ldquo;delete&rdquo;</span> to confirm deletion:
              </span>
            </label>
            <input
              type="text"
              placeholder="Type 'delete' here"
              className="input input-bordered"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDeleting}
            />
          </div>

          {error && (
            <div className="alert alert-error mt-4">
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button 
            className="btn btn-ghost" 
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            className={`btn btn-error ${isDeleting ? 'loading' : ''}`}
            onClick={handleDelete}
            disabled={!isConfirmValid || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Merchant'}
          </button>
        </div>
      </div>
    </div>
  );
} 