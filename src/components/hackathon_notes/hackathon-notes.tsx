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
          <h1 className="text-3xl font-bold tracking-tight">Notes on Our Program, for the Hackathon Judges</h1>
          <br></br>
          <p>
            The current version of the program, including both the Anchor program, and the NextJS front-end are fully functional on devnet. We already have the next version written,
            but don&apos;t want to risk breaking the program/front-end integration without having the time to fix it before the hackathon&apos;s submission date.
            Therefore we will submit it with the current working version, but plan on making further upgrades as we move decisively towards main-net launch with our v1 product.
          </p> <br></br>
          <p>Here is what will change:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-200">
            <li>The current version has 5 instructions: createMerchant, withdrawUsdc, refund, setMerchantStatus, and updateRefundLimit.</li>
            <ul className="list-disc pl-5 mt-2">
            <li>The updated version will have 5 instructions: createMerchant, Withdraw, Refund, setMerchantStatus, and closeMerchant.</li>
            <li>Withdraw is no longer keyed to USDC only, and 8 stablecoin options will be supported.</li>
            <li>The Merchant&apos;s token account will be initialized in the SolanaPay QR code logic at time of payment when needed, and not in the createMerchant instruction.</li>
            <li>The Owner now has the ability to close a Merchant account.</li>
            </ul>
            <li>User feedback from Merchants has pointed out that the Withdraw Funds component, which shows the Merchant&apos;s and Owner&apos;s token balances lacks privacy for the Merchant because a Customer can potentially see the Merchant&apos;s funds when scanning a payment QR code.</li>
            <ul className="list-disc pl-5 mt-2">
              <li>In the upgraded version of the front-end we will move the Merchant&apos;s and Owner&apos;s token balances to a separate page, where the Merchant will be able to manage their funds without risking showing their Customer their account balances on the Point of Sale.</li>
              <li>The Refund button in each Payment History record could also be potentially abused in-person (though unlikely), and refund functionality may also be moved to a more secure page.</li>
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