'use client'

import Image from 'next/image'
import { AppHero } from '../ui/ui-layout'
import { MerchantCard } from './merchant-card'
import { EmptyMerchantState } from './empty-merchant-state'
import { type Merchant } from '@/hooks/find-merchants'

export function DashboardHero({ subtitle }: { subtitle: string }) {
  return (
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
            {subtitle}
          </p>
        }
      />
    </div>
  )
}

export function MerchantGrid({ merchants }: { merchants: Merchant[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {merchants.map((merchant) => (
        <MerchantCard key={merchant.publicKey.toString()} merchant={merchant} />
      ))}
    </div>
  )
}

export function DashboardLoading() {
  return (
    <div className="text-center">
      <span className="loading loading-spinner loading-lg text-mint"></span>
    </div>
  )
}

export function DashboardError({ message }: { message: string }) {
  return (
    <div className="text-center p-8">
      <div className="alert alert-error shadow-lg max-w-xl mx-auto">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{message}</span>
        </div>
      </div>
    </div>
  )
}

export function DashboardContent({ 
  isLoading, 
  merchants, 
  error = null,
  subtitle = "Your Gateway to Seamless Solana Payments" 
}: { 
  isLoading: boolean
  merchants: Merchant[]
  error?: string | null
  subtitle?: string
}) {
  return (
    <div>
      <DashboardHero subtitle={subtitle} />

      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <DashboardLoading />
        ) : error ? (
          <DashboardError message={error} />
        ) : (
          <div className="space-y-8">
            {merchants.length > 0 ? (
              <MerchantGrid merchants={merchants} />
            ) : (
              <EmptyMerchantState />
            )}
          </div>
        )}
      </div>
    </div>
  )
} 