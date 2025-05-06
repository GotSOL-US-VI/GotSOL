'use client'

import { useWallet } from "@getpara/react-sdk"
import { useConnection } from '@/lib/connection-context'
import { useMerchants } from '@/hooks/find-merchants'

/**
 * Hook to access dashboard data
 * Centralizes all data access for the dashboard feature
 */
export function useDashboardData() {
  const { data: wallet } = useWallet()
  const { connection } = useConnection()
  const { merchants, loading, error } = useMerchants(wallet?.address, connection)

  return {
    wallet,
    merchants,
    loading,
    error,
    isConnected: !!wallet?.address
  }
} 