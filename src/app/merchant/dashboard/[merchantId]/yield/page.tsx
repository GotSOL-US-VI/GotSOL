'use client'

import { AppHero } from '@/components/ui/ui-layout'
import { useWalletAdapterCompat } from '@/hooks/useWalletAdapterCompat'
import { useState, useMemo } from 'react'
import { PublicKey } from '@solana/web3.js'
import { usePara } from '@/components/para/para-provider'

interface YieldPosition {
  name: string
  balance: number
  apy?: number
}

export default function YieldPage({ params }: { params: { merchantId: string } }) {
  // Mock data - in real implementation, these would come from on-chain
  const [positions] = useState<YieldPosition[]>([
    {
      name: 'USDC',
      balance: 1234.56,
      apy: 0
    },
    {
      name: 'Perena USD*',
      balance: 473.81,
      apy: 1.1,
    },
    // {
    //   name: 'Solayer sUSD',
    //   balance: 750.25,
    //   apy: 3.97,
    // }
  ])

  const [opportunities] = useState([
    // {
    //   platform: 'Solayer',
    //   asset: 'sUSD',
    //   currentDeposit: 0,
    //   apy: 3.97,
    // },
    {
      platform: 'Perena',
      asset: 'USD*',
      currentDeposit: 0,
      apy: 1.1,
    }
  ])

  const [showBalances, setShowBalances] = useState(true);

  const toggleBalances = () => {
    setShowBalances(!showBalances);
  };

  // Calculate total balance across all positions
  const totalBalance = useMemo(() => {
    const stablecoinTotal = positions.reduce((sum, pos) => sum + pos.balance, 0);
    const lendingTotal = opportunities.reduce((sum, opp) => sum + opp.currentDeposit, 0);
    return stablecoinTotal + lendingTotal;
  }, [positions, opportunities]);

  const { address } = usePara();
  if (!address)
    return null;
  const publicKey = new PublicKey(address);


  if (!publicKey) {
    return (
      <div className="text-center py-12">
        <p className="text-xl opacity-70">Please connect your wallet to view yield opportunities</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">Merchant Treasury / Yield Dashboard</h1>}
        subtitle={<p className="text-xl font-medium mt-4">Manage your yield positions and explore opportunities</p>}
      />
<p className='flex items-center justify-center'>This Product Offering will be built in Phase 4 or later, after core Point of Sale and management features are complete.</p>
      {/* <br></br> */}
      <div className="absolute right-8 -mt-12">
        <div className="card bg-base-300 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium opacity-70">Total Treasury Balance</div>
            <button
              onClick={toggleBalances}
              className="btn btn-ghost btn-xs"
            >
              {showBalances ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              )}
            </button>
          </div>
          <div className="text-2xl font-bold text-mint">
            {showBalances ? `$${totalBalance.toLocaleString()}` : '••••••••'}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Stablecoin Positions */}
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Stablecoin Positions</h2>
              <div className="card bg-base-300">
                <div className="divide-y divide-base-200">
                  {positions.map((position) => (
                    <div key={position.name} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-lg">{position.name}</span>
                        {position.apy !== undefined && position.apy > 0 && (
                          <span className="text-sm text-mint">{position.apy}% APY</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg">
                          {showBalances ? `$${position.balance.toLocaleString()}` : '••••••••'}
                        </span>
                        {position.name !== 'USDC' && (
                          <div className="flex gap-2">
                            <button className="btn btn-xs btn-primary">Deposit</button>
                            <button className="btn btn-xs">Withdraw</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* <div>
              <h2 className="text-xl font-semibold mb-4">Lending Positions</h2>
              <div className="card bg-base-300">
                <div className="divide-y divide-base-200">
                  {opportunities.map((opp) => (
                    <div key={opp.platform} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-lg">{opp.platform}</span>
                        <span className="text-sm text-mint">{opp.apy}% APY</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg">
                          {showBalances ? `$${opp.currentDeposit.toLocaleString()}` : '••••••••'}
                        </span>
                        <div className="flex gap-2">
                          <button className="btn btn-xs btn-primary">Deposit</button>
                          <button className="btn btn-xs">Withdraw</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div> */}
          </div>

          {/* Right Column - Bitcoin Yield */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Bitcoin Yield</h2>
            <div className="card bg-base-300 h-[200px] flex items-center justify-center">
              <div className="text-center p-6">
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-sm opacity-70">Bitcoin yield opportunities.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-8">
          <div>
            <h3 className="font-bold">Coming Soon</h3>
            <p className="text-sm">Live integration with <a href="https://app.perena.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Perena</a>. We intend to offer only Perena&apos;s USD* at the moment because it has no Freeze or Delegate Authority and therefore can not be stolen from you by the issuer, unlike other yield-bearing stablecoin options on the market.</p>
          </div>
        </div>
      </div>
    </div>
  )
} 