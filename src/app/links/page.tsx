'use client'

import { AppHero } from '@/components/ui/ui-layout'
import { Links } from '@/components/links/links'

export default function LinksPage() {
  return (
    <div>
      <AppHero 
        title={<h1 className="text-4xl font-bold">YouTube Guides</h1>}
        subtitle={<p className="text-xl text-gray-600 dark:text-gray-300">Explore these resources to learn more about Kumbaya!</p>}
      />
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Links />
      </div>
    </div>
  )
} 