'use client'

import { AppHero } from '@/components/ui/ui-layout'
import { useWalletAdapterCompat } from '@/hooks/useWalletAdapterCompat'
import { usePara } from '@/components/para/para-provider'
import { PublicKey } from '@solana/web3.js';

export default function OffRampsPage({ params }: { params: { merchantId: string } }) {
  const { address } = usePara();
  if (!address)
    return null;
  const publicKey = new PublicKey(address);

  if (!publicKey) {
    return (
      <div className="text-center py-12">
        <p className="text-xl opacity-70">Please connect your wallet to view off-ramp options</p>
      </div>
    )
  }

  return (
    <div>
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">USD On & Off-Ramps</h1>}
        subtitle={<p className="text-xl font-medium mt-4">Convert your USDC to fiat through our trusted partners</p>}
      />

      <p className='flex justify-center'>This Product Offering should be available at launch, giving Merchant Owners the ability to move money from their bank account on-chain and back. THIS IS A DUMMY UI!</p>

      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="card bg-base-300">
          <div className="divide-y divide-base-200">
            <div className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Kado</h3>
                <p className="text-sm opacity-70 mt-1">Fast and reliable USDC to USD conversion</p>
              </div>
              <button className="btn btn-primary">Off-Ramp with Kado</button>
            </div>

            <div className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">AlchemyPay</h3>
                <p className="text-sm opacity-70 mt-1">Global payment solutions with competitive rates</p>
              </div>
              <button className="btn btn-primary">Off-Ramp with AlchemyPay</button>
            </div>

            <div className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Stripe</h3>
                <p className="text-sm opacity-70 mt-1">Seamless integration with traditional banking</p>
              </div>
              <button className="btn btn-primary">Off-Ramp with Stripe</button>
            </div>

            <div className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Moonpay</h3>
                <p className="text-sm opacity-70 mt-1">Simple and secure fiat off-ramp solution</p>
              </div>
              <button className="btn btn-primary">Off-Ramp with Moonpay</button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-base-300 rounded-lg p-4">
          <h3 className="font-bold mb-2">About Off-Ramps</h3>
          <p className="text-sm opacity-70">
            Our off-ramp partners provide secure and compliant solutions for converting your USDC to traditional currency.
            Each partner may have different fees, processing times, and supported regions. Choose the one that best fits your needs.
          </p>
        </div>
      </div>
    </div>
  )
} 