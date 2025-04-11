import { usePara } from '@/components/para/para-provider';
import { PublicKey } from '@solana/web3.js';

export function useWalletAdapterCompat() {
  const { address, signer } = usePara();
  
//   if (!address || !signer || !signer.sendTransaction) {
//     throw new Error('Wallet adapter is not properly connected or signer is missing methods');
//   }
  return {
    publicKey: address ? new PublicKey(address) : null,
    sendTransaction: signer?.sendTransaction?.bind(signer),
    signTransaction: signer?.signTransaction?.bind(signer),
  };
}