'use client'

import { AppHero } from '@/components/ui/ui-layout'
import { CoinflowWithdraw } from '@/components/CoinflowWithdraw'

export default function OffRampsPage() {
  return (
    <div>
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">Withdraw to Bank Account via Coinflow</h1>}
        subtitle={<p className="text-xl font-medium mt-4">Standard ACH, Same Day ACH, Real-Time Payments, or Push-to-Card </p>}
      />

      {/* Yellow attention line */}
      <div className="text-yellow text-lg text-center py-2 px-4 rounded mb-6 font-semibold">
        ⚠️ Attention: This feature is under construction and is currently non-functional.
      </div>

      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="card bg-base-300">
          <div className="divide-y divide-base-200">
            <CoinflowWithdraw />
          </div>
        </div>
      </div>
    </div>
  )
} 