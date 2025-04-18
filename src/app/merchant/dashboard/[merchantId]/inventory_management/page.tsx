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
          <h1 className="text-3xl font-bold tracking-tight">Manage Your Inventory and Gain Insights Into Your Business&apos;s Sales</h1>
          <br></br>
          <p>
            This Product Offering will be built in Phase 2, after the main Point of Sale is feature-complete.
          </p> <br></br>
          <ul className="list-disc pl-5 space-y-2 text-gray-500">
            <li>View your store&apos;s complete inventory in real-time</li>
            <li>Use advanced search and filtering tools to quickly locate products</li>
            <li>Access detailed product information including SKU details, and sales history</li>
            <li>Set up automated alerts for low stock levels</li>
            <li>Receive smart reordering recommendations based on historical sales patterns</li>
            <li>View customizable reports showing product performance across multiple metrics</li>
            <li>Identify top-performing products and manage slow-moving inventory</li>
            <li>Generate inventory forecasts to optimize stock levels</li>
            <li>Track inventory trends and make data-driven business decisions</li>
            <li>And other essential inventory management features you&apos;ve come to expect or require</li>
          </ul>
        </div>
      </div>

      <div className="card bg-base-300 shadow-xl">
      </div>
    </div>
  )
} 