'use client';

import { ReactNode, useState, useEffect } from 'react';
import { ReactQueryProvider } from '@/app/react-query-provider';
import { ClusterProvider } from '@/components/cluster/cluster-data-access';
import { ConnectionProvider } from '@/lib/devnet-connection-provider';
import { ParaProvider } from '@/components/para/para-provider';
import { DisclaimerProvider } from '@/components/ui/disclaimer-provider';
import { SoundProvider } from '@/components/sound/sound-context';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAccount, useModal } from '@getpara/react-sdk';
import { Toaster } from 'react-hot-toast';
import { AccountChecker } from '@/components/accounts/account-ui';
import { ClusterChecker } from '@/components/cluster/cluster-ui';
import { Footer } from '@/components/ui/footer';
import { SoundToggle } from '@/components/sound/sound-toggle';

// Define proper types for links
export interface NavigationLink {
  label: string | ReactNode;
  path: string;
}

interface ClientProvidersProps {
  children: ReactNode;
  defaultLinks: NavigationLink[];
  merchantLinks: NavigationLink[];
}

export function ClientProviders({ children, defaultLinks, merchantLinks }: ClientProvidersProps) {
  return (
    <ReactQueryProvider>
      <ClusterProvider>
        <ConnectionProvider>
          <ParaProvider>
            <DisclaimerProvider>
              <SoundProvider>
                <ClientSideStateHandler defaultLinks={defaultLinks} merchantLinks={merchantLinks}>
                  {children}
                </ClientSideStateHandler>
              </SoundProvider>
            </DisclaimerProvider>
          </ParaProvider>
        </ConnectionProvider>
      </ClusterProvider>
    </ReactQueryProvider>
  );
}

interface ClientSideStateHandlerProps {
  children: ReactNode;
  defaultLinks: NavigationLink[];
  merchantLinks: NavigationLink[];
}

// Temporary component to handle client-side state
function ClientSideStateHandler({ 
  children, 
  defaultLinks, 
  merchantLinks 
}: ClientSideStateHandlerProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeMerchant, setActiveMerchant] = useState<string | null>(null);
  const { data: account } = useAccount();
  const { openModal } = useModal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Check for saved merchant
    const savedMerchant = localStorage.getItem('activeMerchant');
    if (savedMerchant) {
      setActiveMerchant(savedMerchant);
    }
  }, []);

  // Update active merchant based on route parameters
  useEffect(() => {
    if (!mounted) return;
    
    // Get merchantId from route parameters
    const merchantId = params?.merchantId as string;
    
    if (merchantId) {
      setActiveMerchant(merchantId);
      localStorage.setItem('activeMerchant', merchantId);
    } else if (pathname === '/') {
      // Clear active merchant when returning to home
      setActiveMerchant(null);
      localStorage.removeItem('activeMerchant');
    }
  }, [pathname, params, mounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Handle logo click to clear merchant state and navigate home
  const handleLogoClick = () => {
    setActiveMerchant(null);
    localStorage.removeItem('activeMerchant');
    router.push('/');
  };

  // Determine which links to use based on whether we're in a merchant context
  const isMerchantRoute = !!params?.merchantId;
  const currentLinks = isMerchantRoute || activeMerchant ? merchantLinks : defaultLinks;

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex-col bg-base-100">
      <div className="navbar flex-col md:flex-row space-y-2 md:space-y-0 px-4">
        <div className="flex-1">
          <Link href="/" className="flex items-center" onClick={handleLogoClick}>
            <Image
              src={theme === 'light' ? "/gotsol_light_new.png" : "/gotsol_dark.png"}
              alt="Got Sol Logo"
              width={150}
              height={50}
              className="object-contain w-[150px]"
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

      <ClusterChecker>
        <AccountChecker />
      </ClusterChecker>

      <div className="flex-grow container mx-auto px-4 py-8 mb-16">
        {children}
      </div>
      
      {mounted && <Toaster position="bottom-right" />}
      <Footer />
    </div>
  );
} 