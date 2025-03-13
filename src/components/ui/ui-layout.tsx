'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { ReactNode, Suspense, useEffect, useRef } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import Image from 'next/image'

import { AccountChecker } from '../accounts/account-ui'
import { ClusterChecker, ClusterUiSelect, ExplorerLink } from '../cluster/cluster-ui'
import { WalletButton } from '../solana/solana-provider'

export function UiLayout({ children, links }: { children: ReactNode; links: { label: string; path: string }[] }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <div className="navbar flex-col md:flex-row space-y-2 md:space-y-0 px-4">
        <div className="flex-1">
          <Link href="/" className="flex items-center">
            <Image 
              src="/logo.jpg"
              alt="Got Sol Logo"
              width={150}
              height={50}
              className="object-contain"
            />
          </Link>
          <ul className="menu menu-horizontal px-1 space-x-2">
            {links.map(({ label, path }) => (
              <li key={path}>
                <Link 
                  className={`hover:text-mint transition-colors ${pathname.startsWith(path) ? 'text-mint' : 'text-white'}`} 
                  href={path}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-none space-x-2">
          <WalletButton />
          <ClusterUiSelect />
        </div>
      </div>
      <ClusterChecker>
        <AccountChecker />
      </ClusterChecker>
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
        <Toaster position="bottom-right" />
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
      <div className="modal-box bg-black border border-white/10 space-y-5">
        <h3 className="font-bold text-lg text-mint">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (
              <button className="btn btn-primary" onClick={submit} disabled={submitDisabled}>
                {submitLabel || 'Save'}
              </button>
            ) : null}
            <button onClick={hide} className="btn bg-white/5 hover:bg-white/10 border-white/10">
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
    <div className="hero py-[64px]">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          {typeof title === 'string' ? <h1 className="text-5xl font-bold hero-gradient-text">{title}</h1> : title}
          {typeof subtitle === 'string' ? <p className="py-6 text-white/80">{subtitle}</p> : subtitle}
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
  return (signature: string) => {
    toast.success(
      <div className={'text-center'}>
        <div className="text-lg">Transaction sent</div>
        <ExplorerLink path={`tx/${signature}`} label={'View Transaction'} className="btn btn-xs btn-primary" />
      </div>,
    )
  }
}
