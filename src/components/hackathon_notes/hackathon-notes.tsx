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
          <ul className="list-disc pl-5 space-y-2 text-gray-200">
            <li>Current Instructions: createMerchant, withdrawUsdc, Refund, setMerchantStatus, updateRefundLimit</li>
            <ul className="list-disc pl-5 mt-2">
              <li>New Instructions: createMerchant, Withdraw, Refund, setMerchantStatus, closeMerchant</li>
              <li>Expanding from USDC-only to support 8 stablecoins</li>
              <li>Token accounts will initialize during payment rather than at Merchant creation</li>
              <li>Added Merchant account closure capability</li>
            </ul>
            <li>Privacy Improvements:</li>
            <ul className="list-disc pl-5 mt-2">
              <li>Moving balance displays to a separate Merchant dashboard to prevent customers from seeing sensitive financial data</li>
              <li>Relocating refund functionality to reduce potential for misuse</li>
            </ul>
            {/* <li>Access detailed product information including SKU details, and sales history</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>Set up automated alerts for low stock levels</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>Receive smart reordering recommendations based on historical sales patterns</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>View customizable reports showing product performance across multiple metrics</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>Identify top-performing products and manage slow-moving inventory</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>Generate inventory forecasts to optimize stock levels</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>Track inventory trends and make data-driven business decisions</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul>
            <li>And other essential inventory management features you&apos;ve come to expect or require</li>
            <ul className="list-disc pl-5 mt-2">
              <li>. </li>
            </ul> */}
          </ul>
        </div>
      </div>

      <div className="card bg-base-300 shadow-xl">
      </div>
    </div>
  )
} 