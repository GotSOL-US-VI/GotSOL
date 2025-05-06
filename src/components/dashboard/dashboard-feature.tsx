'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useWallet } from "@getpara/react-sdk";
import { PublicKey, Connection } from '@solana/web3.js'
import { AppHero } from '../ui/ui-layout'
import { BorshCoder, Idl } from '@coral-xyz/anchor'
import idl from '../../utils/kumbaya.json'
import bs58 from 'bs58'
import Image from 'next/image'

interface MerchantAccount {
  owner: PublicKey
  entityName: string
  total_withdrawn: number
  total_refunded: number
  merchant_bump: number
  is_active: boolean
  refund_limit: number
}

interface Merchant {
  publicKey: PublicKey
  account: MerchantAccount
}

export default function DashboardFeature() {
  const { data: wallet } = useWallet()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const lastFetchRef = useRef<number>(0)
  const FETCH_COOLDOWN = 5000 // 5 seconds between fetches

  const connection = new Connection("https://api.devnet.solana.com")
  const programId = new PublicKey(idl.address)

  const fetchMerchants = useCallback(async () => {
    if (!wallet?.address || !mountedRef.current) {
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
      // Get all program accounts with the merchant discriminator
      const allAccounts = await connection.getProgramAccounts(
        programId,
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
                bytes: wallet.address
              }
            }
          ]
        }
      );

      if (!mountedRef.current) return;

      const merchantAccounts = await Promise.all(
        allAccounts.map(async ({ pubkey, account }) => {
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
                is_active: decoded.is_active,
                refund_limit: decoded.refund_limit.toNumber()
              },
            };
          } catch (decodeError) {
            console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
            return null;
          }
        })
      );

      if (!mountedRef.current) return;

      const validMerchants = merchantAccounts
        .filter((m): m is Merchant => m !== null)
        .filter(m => m.account.is_active); // Only show active merchants

      const sortedMerchants = validMerchants.sort((a, b) =>
        a.account.entityName.localeCompare(b.account.entityName)
      );

      setMerchants(sortedMerchants);
      setError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Error fetching merchants:', error)
      setError('Failed to fetch merchants. Please try again later.')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [wallet?.address]);

  // Single effect to handle both initial fetch and polling
  useEffect(() => {
    mountedRef.current = true;
    
    const fetchData = async () => {
      if (mountedRef.current) {
        await fetchMerchants();
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling
    const interval = setInterval(fetchData, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchMerchants]);

  if (!wallet?.address) {
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
                Connect your account to start.
              </p>
            }
          />
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
            ) : (
              <div className="p-6 bg-base-200 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">If you don&apos;t see your merchant accounts:</h3>
                <ul className="list-disc list-inside space-y-2 text-base-content/80">
                  <li>Use the Create Merchant tab above, if you have never made a Merchant with the connected wallet.</li>
                  <li>Reload the page to attempt to retrieve any pre-existing Merchant accounts owned by the connected wallet.</li>
                  <li>If your connected wallet owns any active Merchant accounts they will show here.</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
