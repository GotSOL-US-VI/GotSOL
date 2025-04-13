'use client'

import { PublicKey } from '@solana/web3.js'
import { usePara } from '../para/para-provider'
import { redirect } from 'next/navigation'

export default function AccountListFeature() {
  const { isConnected, openModal, email, address } = usePara();
  if (!address)
    return null;
  const publicKey = new PublicKey(address);


  if (publicKey) {
    return redirect(`/account/${publicKey.toString()}`)
  }

  return (
    <div className="btn btn-primary rounded-btn">
      {isConnected ? (
        <button onClick={() => openModal}>
          {email}
        </button>
      ) : (
        <button onClick={() => openModal}>
          {'Sign in with Para'}
        </button>
      )}
    </div>
  )
}
