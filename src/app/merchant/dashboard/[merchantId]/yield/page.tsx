'use client'

import { AppHero } from '@/components/ui/ui-layout'

export default function YieldPage({ params }: { params: { merchantId: string } }) {
  return (
    <div>
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">Yield Opportunities</h1>}
        subtitle={<p className="text-xl font-medium mt-4">Explore yield opportunities for your funds</p>}
      />
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="card bg-base-300 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-mint">Coming Soon</h2>
            <p className="opacity-70">Yield generation features are under development.</p>
            <p className="opacity-70 mt-2">Soon you'll be able to:</p>
            <ul className="list-disc list-inside opacity-70 mt-2">
              <li>View available yield opportunities</li>
              <li>Stake your funds</li>
              <li>Track your earnings</li>
              <li>Manage your yield positions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 