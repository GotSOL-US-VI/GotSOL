'use client'

import React, { ReactNode, useState } from 'react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // Global default settings for cache persistence
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 60 * 60 * 1000, // 1 hour
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          retry: 2,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          structuralSharing: true,
        },
      },
    })
  )

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  )
}
