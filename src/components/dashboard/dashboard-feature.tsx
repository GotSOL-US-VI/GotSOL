'use client'

import * as anchor from '@coral-xyz/anchor'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useAnchorProvider } from '../solana/solana-provider'
import { AppHero } from '../ui/ui-layout'
import { CreateMerchant } from '../merchant/create-merchant'
import { BorshCoder, Idl } from '@coral-xyz/anchor'
import idl from '../../utils/kumbaya.json'
import bs58 from 'bs58'
import { env } from '../../utils/env'

interface MerchantAccount {
  owner: PublicKey
  entityName: string
  total_withdrawn: number
  total_refunded: number
  merchant_bump: number
}

interface MerchantData {
  publicKey: PublicKey
  account: {
    owner: PublicKey
    entity_name: string
    total_withdrawn: anchor.BN
    total_refunded: anchor.BN
    merchant_bump: number
  }
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
  const [error, setError] = useState<string | null>(null)
  const merchantCacheRef = useRef<{[key: string]: MerchantAccount}>({})
  const lastFetchRef = useRef<number>(0)
  const FETCH_COOLDOWN = 5000 // 5 seconds between fetches

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

      // Check if we should fetch again
      const now = Date.now()
      if (now - lastFetchRef.current < FETCH_COOLDOWN) {
        return
      }
      lastFetchRef.current = now

      try {
        const allAccounts = await program.provider.connection.getProgramAccounts(
          new PublicKey(idl.address),
          {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: bs58.encode(Buffer.from([71, 235, 30, 40, 231, 21, 32, 64]))
                }
              },
              {
                memcmp: {
                  offset: 8,
                  bytes: publicKey.toBase58()
                }
              }
            ]
          }
        );

        // Decode accounts using Borsh directly
        const merchantAccounts = await Promise.all(
          allAccounts.map(async ({ pubkey, account }) => {
            // Check cache first
            const cacheKey = pubkey.toString()
            if (merchantCacheRef.current[cacheKey]) {
              return {
                publicKey: new PublicKey(pubkey),
                account: merchantCacheRef.current[cacheKey]
              }
            }

            try {
              if (account.data.length !== 81) {
                return null;
              }

              const coder = new BorshCoder(idl as Idl);
              const decoded = coder.accounts.decode('Merchant', account.data);
              
              // Cache the decoded account
              merchantCacheRef.current[cacheKey] = {
                owner: decoded.owner,
                entityName: decoded.entity_name,
                total_withdrawn: decoded.total_withdrawn.toNumber(),
                total_refunded: decoded.total_refunded.toNumber(),
                merchant_bump: decoded.merchant_bump
              };

              return {
                publicKey: new PublicKey(pubkey),
                account: merchantCacheRef.current[cacheKey]
              };
            } catch (err) {
              return null;
            }
          })
        );

        const validMerchants = merchantAccounts.filter((m): m is Merchant => m !== null);
        setMerchants(validMerchants);
        setError(null);
      } catch (error) {
        console.error('Error fetching merchants:', error)
        setError('Failed to fetch merchants. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchMerchants()
    
    // Set up an interval to refresh data periodically
    const interval = setInterval(fetchMerchants, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
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
                  <div key={merchant.publicKey.toString()} className="card bg-base-300 shadow-xl">
                    <div className="card-body">
                      <h2 className="card-title">{merchant.account.entityName}</h2>
                      <p className="text-sm text-gray-500">
                        {merchant.publicKey.toString().slice(0, 4)}...{merchant.publicKey.toString().slice(-4)}
                      </p>
                      <div className="card-actions justify-end">
                        <button
                          className="btn btn-primary btn-lg gap-2"
                          onClick={() => window.location.href = `/merchant/dashboard/${merchant.publicKey.toString()}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Enter Point of Sale
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {showCreateForm ? (
              <div className="card bg-base-300 shadow-xl">
                <div className="card-body bg-base-300">
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
