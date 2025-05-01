'use client'

import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@getpara/react-sdk'
import { useParaModal } from '../para/para-provider'

export default function AccountListFeature() {
  const { data: wallet } = useWallet();
  const { openModal } = useParaModal();
  const address = wallet?.address;
  const email = (wallet as any)?.email;
  const isConnected = !!address;

  if (!address) {
    return (
      <div className="btn btn-primary rounded-btn">
        <button onClick={openModal}>
          Sign in with Para
        </button>
      </div>
    );
  }

  const publicKey = new PublicKey(address);

  return (
    <div className="btn btn-primary rounded-btn">
      <button>
        {email || address.slice(0, 4) + '...' + address.slice(-4)}
      </button>
    </div>
  );
}
