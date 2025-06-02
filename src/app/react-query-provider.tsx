'use client'

import React, { ReactNode, useState } from 'react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'

// Optimized React Query configuration with reduced aggressive refetching
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 10 minutes (increased from 5)
      staleTime: 10 * 60 * 1000,
      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 2 times for other errors (reduced from 3)
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // More conservative refetch behavior
      refetchOnWindowFocus: false, // Disable to reduce noise
      refetchOnMount: false, // Only fetch if stale
      // Remove automatic polling - use event-based invalidations instead
      refetchInterval: false, // ✅ No time-based polling - rely on events
      // Only refetch in background if tab is visible
      refetchIntervalInBackground: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
})

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  // Create query client with optimized settings
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
