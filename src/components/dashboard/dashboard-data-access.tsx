'use client'

import { useWallet } from "@getpara/react-sdk"
import { useConnection } from '@/lib/connection-context'
import { useMerchants } from '@/hooks/find-merchants'

/**
 * Hook to access dashboard data
 * Simplified to avoid duplicate caching logic
 */
export function useDashboardData() {
  const { data: wallet } = useWallet()
  const { connection } = useConnection()

  // Use the centralized merchant hook
  const { merchants, loading, error } = useMerchants(wallet?.address, connection)

  return {
    wallet,
    merchants,
    loading,
    error,
    isConnected: !!wallet?.address
  }
} 