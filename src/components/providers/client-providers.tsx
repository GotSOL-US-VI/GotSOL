'use client';

import { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import { ReactQueryProvider } from '@/app/react-query-provider';
import { ClusterProvider } from '@/components/cluster/cluster-data-access';
import { ConnectionProvider } from '@/lib/devnet-connection-provider';
import { ParaProvider } from '@/components/para/para-provider';
import { DisclaimerProvider } from '@/components/ui/disclaimer-provider';
import { SoundProvider } from '@/components/sound/sound-context';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAccount, useModal, useWallet } from '@getpara/react-sdk';
import { Toaster } from 'react-hot-toast';
import { AccountChecker } from '@/components/accounts/account-ui';
import { ClusterChecker } from '@/components/cluster/cluster-ui';
import { Footer } from '@/components/ui/footer';
import { SoundToggle } from '@/components/sound/sound-toggle';
import { useConnection } from '@/lib/connection-context';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

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

// Enhanced logging utility for client providers
function logClientProvidersCall(operation: string, details?: any, line?: string) {
  const error = new Error();
  const stack = error.stack?.split('\n');
  
  // Find the calling line in client-providers
  let callingLine = line || 'Unknown';
  
  if (!line && stack) {
    for (let i = 1; i < stack.length; i++) {
      const stackLine = stack[i];
      if (stackLine.includes('client-providers.tsx')) {
        const match = stackLine.match(/:(\d+):\d+/);
        if (match) {
          callingLine = match[1];
          break;
        }
      }
    }
  }
  
  const timestamp = new Date().toISOString();
  console.log(
    `%c[${timestamp}] CLIENT PROVIDERS: ${operation}`,
    'color: #9c27b0; font-weight: bold;',
    `\n  📍 Component: ClientProviders:${callingLine}`,
    `\n  🔧 Hook/Function: client-providers.tsx`,
    details ? `\n  📊 Details: ${JSON.stringify(details, null, 2)}` : ''
  );
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
  const { data: wallet } = useWallet();
  const { openModal } = useModal();
  const [mounted, setMounted] = useState(false);
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  // Enhanced logging for component initialization
  useEffect(() => {
    logClientProvidersCall('ClientSideStateHandler Initialized', {
      pathname,
      hasAccount: !!account,
      hasWallet: !!wallet,
      walletAddress: wallet?.address,
      hasConnection: !!connection
    });
  }, [pathname, account, wallet, connection]);

  useEffect(() => {
    setMounted(true);
    
    logClientProvidersCall('Component mounted, loading saved preferences', {
      pathname
    });
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      logClientProvidersCall('Loading saved theme', { savedTheme });
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Check for saved merchant
    const savedMerchant = localStorage.getItem('activeMerchant');
    if (savedMerchant) {
      logClientProvidersCall('Loading saved merchant', { savedMerchant });
      setActiveMerchant(savedMerchant);
    }
  }, [pathname]);

  // Update active merchant based on route parameters
  useEffect(() => {
    if (!mounted) return;
    
    // Get merchantId from route parameters
    const merchantId = params?.merchantId as string;
    
    logClientProvidersCall('Route change detected', {
      pathname,
      merchantId,
      currentActiveMerchant: activeMerchant,
      mounted
    });
    
    if (merchantId) {
      logClientProvidersCall('Setting active merchant from route', {
        merchantId,
        previousMerchant: activeMerchant
      });
      
      setActiveMerchant(merchantId);
      localStorage.setItem('activeMerchant', merchantId);
    } else if (pathname === '/') {
      // Clear active merchant when returning to home
      logClientProvidersCall('Clearing active merchant - returned to home', {
        previousMerchant: activeMerchant
      });
      
      setActiveMerchant(null);
      localStorage.removeItem('activeMerchant');
    }
  }, [pathname, params, mounted, activeMerchant]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    logClientProvidersCall('Theme toggled', {
      previousTheme: theme,
      newTheme
    });
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, [theme]);

  // Handle logo click to clear merchant state and navigate home
  const handleLogoClick = useCallback(async () => {
    logClientProvidersCall('Logo clicked - clearing state and navigating home', {
      currentActiveMerchant: activeMerchant,
      hasWallet: !!wallet,
      hasConnection: !!connection
    });
    
    // Clear payment cache for current merchant if we have one
    if (activeMerchant && typeof window !== 'undefined') {
      try {
        const paymentCacheKey = `gotsol_payments_${activeMerchant}_true`; // Assuming devnet for now
        localStorage.removeItem(paymentCacheKey);
        logClientProvidersCall('Payment cache cleared for merchant', { merchantId: activeMerchant });
      } catch (error) {
        console.error('Error clearing payment cache:', error);
      }
    }
    
    // Clear merchant state
    setActiveMerchant(null);
    localStorage.removeItem('activeMerchant');
    
    // Navigate to home - the route change effect will handle the rest
    router.push('/');
    
    logClientProvidersCall('Navigation to home completed');
  }, [activeMerchant, wallet, connection, router]);

  // Determine which links to use based on whether we're in a merchant context
  const isMerchantRoute = !!params?.merchantId;
  const currentLinks = isMerchantRoute || activeMerchant ? merchantLinks : defaultLinks;

  // Memoize navigation state to prevent unnecessary re-renders
  const navigationState = useMemo(() => ({
    isMerchantRoute,
    activeMerchant,
    linksType: isMerchantRoute || activeMerchant ? 'merchant' : 'default',
    mounted
  }), [isMerchantRoute, activeMerchant, mounted]);

  // Only re-render navigation when state actually changes
  const renderNavigation = useCallback(() => {
    return (
      <div className="min-h-screen flex-col bg-base-100">
        <div className="navbar flex-col md:flex-row space-y-2 md:space-y-0 px-4">
          <div className="flex-1">
            <Link href="/" className="flex items-center" onClick={handleLogoClick}>
              <Image
                src={theme === 'light' ? "/gotsol_light.png" : "/gotsol_dark.png"}
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
  }, [theme, pathname, activeMerchant, currentLinks, account, openModal, mounted, handleLogoClick, toggleTheme, children]);

  // Only re-render navigation when state actually changes
  const navigationComponent = useMemo(() => {
    return renderNavigation();
  }, [renderNavigation]);

  if (!mounted) return null;

  return navigationComponent;
}

// Memoized navigation component to prevent unnecessary re-renders
const MemoizedNavigation = React.memo(({ 
  isMerchantRoute, 
  activeMerchant, 
  linksType, 
  mounted 
}: {
  isMerchantRoute: boolean;
  activeMerchant: string | null;
  linksType: string;
  mounted: boolean;
}) => {
  // Only log when values actually change
  const navigationKey = `${isMerchantRoute}-${activeMerchant}-${linksType}-${mounted}`;
  
  logClientProvidersCall('Rendering navigation', {
    isMerchantRoute,
    activeMerchant,
    linksType,
    mounted,
    navigationKey
  });

  // Your existing navigation rendering logic here
  return (
    <nav>
      {/* Your navigation JSX */}
    </nav>
  );
});

MemoizedNavigation.displayName = 'MemoizedNavigation'; 