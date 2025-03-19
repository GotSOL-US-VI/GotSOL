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
import Image from 'next/image'

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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const merchantCacheRef = useRef<{ [key: string]: MerchantAccount }>({})
  const lastFetchRef = useRef<number>(0)
  const FETCH_COOLDOWN = 5000 // 5 seconds between fetches
  const MIN_ACCOUNT_SIZE = 81; // Set this to the minimum valid size for your Merchant PDA accounts

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark'
          setTheme(newTheme)
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    return () => observer.disconnect()
  }, [])

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
        // Sort merchants alphabetically by entity name
        const sortedMerchants = validMerchants.sort((a, b) =>
          a.account.entityName.localeCompare(b.account.entityName)
        );
        setMerchants(sortedMerchants);
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
        <div className="-mt-20">
          <AppHero
            title={<h1 className="text-6xl font-bold hero-gradient-text bg-clip-text">GotSOL</h1>}
            subtitle={<p className="text-xl font-medium mt-4">Connect your wallet to get started</p>}
          />
          <div className="flex justify-center">
            <div className="w-32 h-32 relative">
              <Image
                src="/logo.png"
                alt="Got Sol Logo"
                width={180}
                height={180}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="-mt-20">
        <AppHero
          title={
            <div className="space-y-4">
              <h1 className="text-6xl font-bold hero-gradient-text">GotSOL</h1>
              <div className="flex justify-center">
                <div className="w-32 h-32 relative">
                  <Image
                    src="/logo.png"
                    alt="Got Sol Logo"
                    width={180}
                    height={180}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          }
          subtitle={
            <p className="text-xl font-medium opacity-80">
              Your Gateway to Seamless Solana Payments
            </p>
          }
        />
      </div>

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
                      <p className="text-sm opacity-60">
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
            ) :
              <div className="text-center py-12">
                <h3 className="text-2xl font-semibold opacity-80 mb-4">No Merchant Accounts Found</h3>
                <p className="opacity-60 mb-8">Get started by creating your first merchant account</p>
                <Link href="/merchant/setup" className="btn btn-primary btn-lg">
                  Create Merchant Account
                </Link>
              </div>
            }
          </div>
        )}
      </div>
    </div>
  )
}
