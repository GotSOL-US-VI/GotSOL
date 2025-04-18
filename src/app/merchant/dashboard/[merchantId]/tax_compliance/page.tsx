'use client'

import { PublicKey } from '@solana/web3.js'
import { useEffect, useState } from 'react'
import { EmployeeList } from '@/components/employees/employee-ui'
import { IconReceipt } from '@tabler/icons-react'

export default function ManageAccountsPage({ params }: { params: { merchantId: string } }) {
  const [mounted, setMounted] = useState(false)

  // Client-side only to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const merchantId = new PublicKey(params.merchantId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automate Tax Payments and Compliance for your Business</h1>
          <br></br>
          <p className="text-gray-500">
          This Product Offering will be built in Phase 3, after Inventory Management is feature-complete, and we have more specifics on exactly what features and customization are required here.
          </p>
          <br></br>
          <p className="text-gray-500">
            What you see now is modeled on the US Virgin Islands 5% tax on a business's monthly gross receipts.
            Different businesses will fall into different tax brackets, but for now we are mocking a tax burden of 5% of gross revenue, paid monthly.
            Here is how it currently works:
          </p>
          <br></br>
          <ul className="list-disc pl-5 space-y-2 text-gray-500">
            <li>
              When the Owner withdraws USDC from the Merchant's account, 5% of the withdrawal amount is deposited into a separate escrow dedicated to tax/compliance payments.
            </li>
            <li>
              The other 93.5% goes to the Merchant's Owner's USDC account, and 1.5% goes to the House's platform fee.
            </li>
            <li>The 5% diverted to the Merchant's compliance escrow continues to accrue USDC each time the Merchant's Owner withdraws from the Merchant's USDC account.</li>
            <li>
              Once the time comes to pay their monthly tax bill, the Owner can click the "Pay The Man" button and 100% of the Merchant's compliance escrow will be paid to THE MAN's USDC account.
            </li>
            <li>This achieves a preliminary level of automation regarding the disbersion and allocation of revenues, while ensuring all 3 interested parties are either paid, or earmarked funds simultaneously (The Merchant's Owner, the House, and THE MAN); all during the withdrawal of USDC from the Merchant's account.</li>
          </ul>
          <br></br>
          <p>We have decided to build and showcase this feature as an example of WHAT COULD BE possible, or a direction that we'd like to begin a conversation around and work towards; both on the Merchant's end, and the Government/Tax Authority's end. This assumes that the Government and relevant departments have been onboarded with their own accounts, and are willing to accept tax payments in this manner.</p>
        </div>

      </div>

      <div className="card bg-base-300 shadow-xl">

      </div>
    </div>
  )
} 