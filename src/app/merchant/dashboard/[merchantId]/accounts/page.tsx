'use client'

import { AppHero } from '@/components/ui/ui-layout'

export default function ManageAccountsPage({ params }: { params: { merchantId: string } }) {
  return (
    <div>
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">Manage Accounts</h1>}
        subtitle={<p className="text-xl font-medium mt-4">Manage your merchant and employee accounts</p>}
      />
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="card bg-base-300 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-mint">Coming Soon</h2>
            <p className="opacity-70">Account management features are under development.</p>
          </div>
        </div>
      </div>
    </div>
  )
} 