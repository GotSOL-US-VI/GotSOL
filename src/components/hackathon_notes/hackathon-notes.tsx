'use client'

import { useEffect, useState } from 'react'

export default function HackathonNotes() {
  const [mounted, setMounted] = useState(false)

  // Client-side only to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hackathon Submission Notes</h1>
          <p className="mt-4">
            Our current implementation is fully functional on devnet. While we&apos;ve developed an improved version, we&apos;re submitting the stable release to ensure reliability. Post-hackathon upgrades are planned for our mainnet launch.
          </p>
          <p className="mt-4 font-medium">Key Upcoming Changes:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-500">
            <li>
              Current Instructions: createMerchant, withdrawUsdc, Refund, setMerchantStatus, updateRefundLimit
              <ul className="list-disc pl-5 mt-2">
                <li>New Instructions: createMerchant, Withdraw, Refund, setMerchantStatus, closeMerchant</li>
                <li>Expanding from USDC-only to support 8 stablecoins</li>
                <li>Token accounts will initialize during payment rather than at Merchant creation</li>
                <li>Added Merchant account closure capability</li>
                <li>The existing Refund attack surface is covered by our secure front end and Para&apos;s API keys signing transactions that originate only from our app&apos;s URL, therefore we have removed the updateRefundLimit instruction for now</li>
              </ul>
            </li>
            <li>
              Privacy Improvements:
              <ul className="list-disc pl-5 mt-2">
                <li>Moving balance displays to a separate Merchant dashboard to prevent customers from seeing sensitive financial data</li>
                <li>Relocating refund functionality to reduce potential for misuse</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <div className="card bg-base-300 shadow-xl">
      </div>
    </div>
  )
} 