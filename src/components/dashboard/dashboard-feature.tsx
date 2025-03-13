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
import Link from 'next/link'

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
  const MIN_ACCOUNT_SIZE = 81; // Set this to the minimum valid size for your Merchant PDA accounts

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

        const merchantAccounts = await Promise.all(
          allAccounts.map(async ({ pubkey, account }) => {
            console.log(`Account ${pubkey.toString()} size: ${account.data.length}`); // Log account size

            if (account.data.length < MIN_ACCOUNT_SIZE) {
              console.warn(`Excluding account ${pubkey.toString()} due to insufficient size`); // Log exclusion
              return null; // Exclude invalid accounts
            }

            try {
              const coder = new BorshCoder(idl as Idl);
              const decoded = coder.accounts.decode('Merchant', account.data);
              
              return {
                publicKey: new PublicKey(pubkey),
                account: {
                  owner: decoded.owner,
                  entityName: decoded.entity_name,
                  total_withdrawn: decoded.total_withdrawn.toNumber(),
                  total_refunded: decoded.total_refunded.toNumber(),
                  merchant_bump: decoded.merchant_bump,
                },
              };
            } catch (decodeError) {
              console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
              return null; // Return null if decoding fails
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
          title={<h1 className="text-6xl font-bold hero-gradient-text bg-clip-text">Got SOL</h1>}
          subtitle={<p className="text-xl font-medium text-gray-600 dark:text-gray-300 mt-4">Connect your wallet to get started</p>}
        />
      </div>
    )
  }

  return (
    <div>
      <AppHero
        title={
          <div className="space-y-4">
            <h1 className="text-6xl font-bold hero-gradient-text">Got SOL</h1>
            <div className="flex justify-center">
              <div className="w-24 h-24 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-mint to-lavender animate-pulse-slow"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-3 h-3"
                      style={{
                        transform: `rotate(${i * 36}deg) translateY(-32px)`,
                      }}
                    >
                      <div className="w-full h-full bg-gradient-to-r from-mint to-light-blue animate-pulse-slow"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
        subtitle={
          <p className="text-xl font-medium text-white/80">
            Your Gateway to Seamless Solana Payments
          </p>
        }
      />

      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-mint"></span>
          </div>
        ) : (
          <div className="space-y-8">
            {merchants.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {merchants.map((merchant) => (
                  <div key={merchant.publicKey.toString()} className="card hover:border-mint/50 transition-colors">
                    <div className="card-body">
                      <h2 className="card-title text-mint">{merchant.account.entityName}</h2>
                      <p className="text-sm text-white/60">
                        {merchant.publicKey.toString().slice(0, 4)}...{merchant.publicKey.toString().slice(-4)}
                      </p>
                      <div className="card-actions justify-end mt-4">
                        <button
                          className="btn btn-primary gap-2"
                          onClick={() => window.location.href = `/merchant/dashboard/${merchant.publicKey.toString()}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Enter Point of Sale
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-2xl font-semibold text-white/80 mb-4">No Merchant Accounts Found</h3>
                <p className="text-white/60 mb-8">Get started by creating your first merchant account</p>
                <Link href="/merchant/setup" className="btn btn-primary btn-lg">
                  Create Merchant Account
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
