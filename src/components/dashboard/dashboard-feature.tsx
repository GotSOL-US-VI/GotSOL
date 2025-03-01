'use client'

import * as anchor from '@coral-xyz/anchor'
import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useAnchorProvider } from '../solana/solana-provider'
import { AppHero } from '../ui/ui-layout'
import { CreateMerchant } from '../merchant/create-merchant'
import idl from '../../utils/kumbaya.json'

interface MerchantAccount {
  owner: PublicKey
  entityName: string
  merchantBump: number
}

interface Merchant {
  publicKey: PublicKey
  account: MerchantAccount
}

export default function DashboardFeature() {
  const { publicKey } = useWallet()
  const provider = useAnchorProvider()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Create program instance if provider is available
  const program = useMemo(() =>
    provider ? new anchor.Program(idl as anchor.Idl, provider) : null
    , [provider])

  useEffect(() => {
    const fetchMerchants = async () => {
      if (!program || !publicKey) {
        setMerchants([])
        setLoading(false)
        return
      }

      try {
        const merchantAccounts = await (program.account as any).merchant.all([
          {
            memcmp: {
              offset: 8, // Discriminator length
              bytes: publicKey.toBase58()
            }
          }
        ])

        setMerchants(merchantAccounts as Merchant[])
      } catch (error) {
        console.error('Error fetching merchants:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMerchants()
  }, [program, publicKey])

  const handleMerchantCreated = (merchantPubkey: PublicKey) => {
    setShowCreateForm(false)
    // Refresh merchants list
    if (program && publicKey) {
      ; (program.account as any).merchant.fetch(merchantPubkey).then((account: MerchantAccount) => {
        setMerchants([...merchants, { publicKey: merchantPubkey, account }])
      })
    }
  }

  if (!publicKey) {
    return (
      <div>
        <AppHero
          title={<h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Welcome to Kumbaya</h1>}
          subtitle={<p className="text-xl font-medium text-gray-600 dark:text-gray-300 mt-4">Connect your wallet to get started</p>}
        />
      </div>
    )
  }

  return (
    <div>
      <AppHero
        title={<h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Welcome to Kumbaya</h1>}
        subtitle={<p className="text-xl font-medium text-gray-600 dark:text-gray-300 mt-4">Seamless USDC Payments on Solana</p>}
      />

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="space-y-6">
            {merchants.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {merchants.map((merchant) => (
                  <div key={merchant.publicKey.toString()} className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                      <h2 className="card-title">{merchant.account.entityName}</h2>
                      <p className="text-sm text-gray-500">
                        {merchant.publicKey.toString().slice(0, 4)}...{merchant.publicKey.toString().slice(-4)}
                      </p>
                      <div className="card-actions justify-end">
                        <button
                          className="btn btn-primary"
                          onClick={() => window.location.href = `/merchant/dashboard/${merchant.publicKey.toString()}`}
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {showCreateForm ? (
              <div className="card bg-base-300 shadow-xl">
                <div className="card-body">
                  {/* <h2 className="card-title mb-4">Create New Merchant!</h2> */}
                  {program && <CreateMerchant program={program} onSuccess={handleMerchantCreated} />}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <button
                  className="btn btn-primary btn-lg text-xl"
                  onClick={() => setShowCreateForm(true)}
                >
                  Create New Merchant
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
