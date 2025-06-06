'use client'

import { ReactNode, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { AccountChecker } from '../accounts/account-ui'
import { ClusterChecker } from '../cluster/cluster-ui'
import { NavBar } from './navbar'
import { useMounted } from '@/hooks/use-mounted'

interface UiLayoutProps {
  children: ReactNode
  defaultLinks: { label: string | ReactNode; path: string }[]
  merchantLinks: { label: string | ReactNode; path: string }[]
}

/**
 * Main layout component that provides the UI shell
 */
export function UiLayout({
  children,
  defaultLinks,
  merchantLinks,
}: UiLayoutProps) {
  const mounted = useMounted();

  return (
    <div className="min-h-screen flex-col bg-base-100">
      <NavBar 
        defaultLinks={defaultLinks} 
        merchantLinks={merchantLinks} 
      />
      
      <ClusterChecker>
        <AccountChecker />
      </ClusterChecker>
      
      <div className="flex-grow container mx-auto px-4 py-8 mb-16">
        <Suspense
          fallback={
            <div className="text-center my-32">
              <span className="loading loading-spinner loading-lg text-mint"></span>
            </div>
          }
        >
          {children}
        </Suspense>
        {mounted && <Toaster position="bottom-right" />}
      </div>
    </div>
  )
}

/**
 * Hero component for page headers
 */
export function AppHero({
  children,
  title,
  subtitle,
}: {
  children?: ReactNode
  title: ReactNode
  subtitle: ReactNode
}) {
  return (
    <div className="hero py-[32px]">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          {title}
          {typeof subtitle === 'string' ? <p className="py-2 text-base-content/80">{subtitle}</p> : subtitle}
          {children}
        </div>
      </div>
    </div>
  )
}
