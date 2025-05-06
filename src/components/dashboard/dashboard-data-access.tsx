'use client'

import { useWallet } from "@getpara/react-sdk"
import { useConnection } from '@/lib/connection-context'
import { useMerchants } from '@/hooks/find-merchants'
import { useQueryClient } from '@tanstack/react-query'
import { fetchMerchantData } from '@/hooks/find-merchants'

/**
 * Hook to access dashboard data
 * Centralizes all data access for the dashboard feature
 */
export function useDashboardData() {
  const { data: wallet } = useWallet()
  const { connection } = useConnection()

  // Set up React Query to handle client-side merchant data fetching
  const { merchants, loading, error } = useMerchants(wallet?.address, connection)

  // Use queryClient to help with prefetching or accessing React Query cache
  const queryClient = useQueryClient()
  
  // Prefetch merchants data when connection and wallet change
  if (wallet?.address && connection) {
    queryClient.prefetchQuery({
      queryKey: ['merchants', wallet.address],
      queryFn: () => fetchMerchantData(wallet.address, connection),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  return {
    wallet,
    merchants,
    loading,
    error,
    isConnected: !!wallet?.address
  }
} 