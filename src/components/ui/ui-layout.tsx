'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'

import { AccountChecker } from '../accounts/account-ui'
import { ClusterChecker, ClusterUiSelect, ExplorerLink } from '../cluster/cluster-ui'
import { usePara } from "@/components/para/para-provider";
// import { WalletButton } from '../para/para-provider'

interface Link {
  label: string | ReactNode;
  path: string;
}

interface UiLayoutProps {
  children: ReactNode;
  defaultLinks: Link[];
  merchantLinks: Link[];
}

export function UiLayout({
  children,
  defaultLinks,
  merchantLinks,
}: UiLayoutProps) {
  const pathname = usePathname()
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark')
  const [activeMerchant, setActiveMerchant] = React.useState<string | null>(null)
  const { isConnected, openModal, email, address } = usePara();
  const [mounted, setMounted] = React.useState(false)

  // console.log("wallet:", address);
  useEffect(() => {
    setMounted(true)
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }

    // Check for saved merchant
    const savedMerchant = localStorage.getItem('activeMerchant')
    if (savedMerchant) {
      setActiveMerchant(savedMerchant)
    }
  }, [])

  // Update active merchant when entering a merchant dashboard
  useEffect(() => {
    const merchantMatch = pathname.match(/\/merchant\/dashboard\/([^/]+)/)
    if (merchantMatch) {
      const merchantId = merchantMatch[1]
      setActiveMerchant(merchantId)
      localStorage.setItem('activeMerchant', merchantId)
    } else if (pathname === '/') {
      // Clear active merchant when returning to home
      setActiveMerchant(null)
      localStorage.removeItem('activeMerchant')
    }
  }, [pathname])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  // Handle logo click to clear merchant state
  const handleLogoClick = () => {
    setActiveMerchant(null)
    localStorage.removeItem('activeMerchant')
  }

  const currentLinks = activeMerchant ? merchantLinks : defaultLinks

  // Return a consistent structure during server-side rendering
  // This prevents hydration mismatches
  return (
    <div className="min-h-screen flex-col bg-base-100">
      {mounted ? (
        <>
          <div className="navbar flex-col md:flex-row space-y-2 md:space-y-0 px-4">
            <div className="flex-1">
              <Link href="/" className="flex items-center" onClick={handleLogoClick}>
                <Image
                  src={theme === 'light' ? "/gotsol_light.png" : "/gotsol_dark.png"}
                  alt="Got Sol Logo"
                  width={150}
                  height={50}
                  className="object-contain"
                />
              </Link>
              <ul className="menu menu-horizontal px-1 space-x-2">
                {currentLinks.map(({ label, path }) => (
                  <li key={path}>
                    {typeof label === 'string' ? (
                      <Link
                        href={activeMerchant ? path.replace(':merchantId', activeMerchant) : path}
                        className={`hover:text-mint transition-colors ${pathname === path.replace(':merchantId', activeMerchant || '') ||
                          (path === '/merchant/dashboard/:merchantId' && pathname === `/merchant/dashboard/${activeMerchant}`)
                          ? 'text-mint'
                          : ''
                          }`}
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-none space-x-2 flex items-center">
              <button
                onClick={toggleTheme}
                className="btn btn-ghost btn-circle"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                )}
              </button>
              <div className="btn btn-primary rounded-btn">
                {isConnected ? (
                  <button onClick={openModal}>
                    {email}
                  </button>
                ) : (
                  <button onClick={openModal}>
                    {'Sign in with Para'}
                  </button>
                )}
              </div>
              {/* <WalletButton /> */}
              {/* <ClusterUiSelect /> */}
            </div>
          </div>
          <ClusterChecker>
            <AccountChecker />
          </ClusterChecker>
        </>
      ) : (
        // Placeholder during server-side rendering
        <div className="navbar flex-col md:flex-row space-y-2 md:space-y-0 px-4">
          <div className="flex-1">
            <div className="flex items-center">
              <div className="w-[150px] h-[50px] bg-gray-200"></div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-grow container mx-auto px-4 py-8">
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

export function AppModal({
  children,
  title,
  hide,
  show,
  submit,
  submitDisabled,
  submitLabel,
}: {
  children: ReactNode
  title: string
  hide: () => void
  show: boolean
  submit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (!dialogRef.current) return
    if (show) {
      dialogRef.current.showModal()
    } else {
      dialogRef.current.close()
    }
  }, [show, dialogRef])

  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box space-y-5">
        <h3 className="font-bold text-lg text-mint">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (
              <button className="btn btn-primary" onClick={submit} disabled={submitDisabled}>
                {submitLabel || 'Save'}
              </button>
            ) : null}
            <button onClick={hide} className="btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

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
          {typeof subtitle === 'string' ? <p className="py-2 text-white/80">{subtitle}</p> : subtitle}
          {children}
        </div>
      </div>
    </div>
  )
}

export function ellipsify(str = '', len = 4) {
  if (str.length > 30) {
    return str.substring(0, len) + '..' + str.substring(str.length - len, str.length)
  }
  return str
}

export function useTransactionToast() {
  return (signature: string, solscanLink?: string) => {
    toast.success(
      <div className={'text-center'}>
        <div className="text-lg">Transaction sent</div>
        {solscanLink ? (
          <a 
            href={solscanLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-xs btn-primary mt-2"
          >
            View on Solscan
          </a>
        ) : (
          <ExplorerLink path={`tx/${signature}`} label={'View Transaction'} className="btn btn-xs btn-primary" />
        )}
      </div>,
    )
  }
}
