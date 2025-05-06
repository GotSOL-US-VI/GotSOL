import { cachedApiResponse } from '@/lib/api-cache'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  return cachedApiResponse(
    request,
    async () => ({ 
      message: 'Hello, World!',
      timestamp: new Date().toISOString()
    }),
    {
      revalidate: 30, // Cache for 30 seconds
      tags: ['hello']
    }
  )
}
