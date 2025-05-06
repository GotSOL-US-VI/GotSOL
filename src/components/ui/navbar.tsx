'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAccount, useModal } from '@getpara/react-sdk';
import { useTheme } from '@/hooks/use-theme';
import { useMerchant } from '@/hooks/use-merchant';

interface NavBarProps {
  defaultLinks: { label: string | ReactNode; path: string }[];
  merchantLinks: { label: string | ReactNode; path: string }[];
}

export function NavBar({ defaultLinks, merchantLinks }: NavBarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { activeMerchant, handleLogoClick } = useMerchant();
  const { data: account } = useAccount();
  const { openModal } = useModal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentLinks = activeMerchant ? merchantLinks : defaultLinks;

  // Early return during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="navbar flex-col md:flex-row space-y-2 md:space-y-0 px-4">
        <div className="flex-1">
          <div className="flex items-center">
            <div className="w-[150px] h-[50px] bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
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
          {account?.isConnected ? (
            <button onClick={openModal}>
              {account.email}
            </button>
          ) : (
            <button onClick={openModal}>
              {'Sign in with Para'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 