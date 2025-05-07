import { NextRequest, NextResponse } from 'next/server'

type CacheOptions = {
  revalidate?: number | false
  tags?: string[]
}

/**
 * Helper function to handle API responses with proper caching
 */
export async function cachedApiResponse<T>(
  request: NextRequest,
  dataFn: () => Promise<T>,
  options: CacheOptions = {}
) {
  const { revalidate = 60, tags = [] } = options
  
  try {
    const data = await dataFn()
    
    return NextResponse.json(
      { success: true, data },
      {
        status: 200,
        headers: {
          'Cache-Control': revalidate === false
            ? 'no-store'
            : `max-age=0, s-maxage=${revalidate}`,
        }
      }
    )
  } catch (error) {
    console.error('API error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 