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
          <h1 className="text-3xl font-bold tracking-tight">Manage Employees</h1>
          <p className="text-gray-500">
            Manage your employee and manager accounts
          </p>
        </div>
        <div className="bg-primary/10 p-3 rounded-full">
          <IconReceipt size={24} className="text-primary" />
        </div>
      </div>

      <div className="card bg-base-300 shadow-xl">
        <div className="card-body p-6">
          <EmployeeList merchantId={merchantId} />
        </div>
      </div>
    </div>
  )
} 