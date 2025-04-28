'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import { 
  IconHome, 
  IconSettings, 
  IconCoins, 
  IconCashBanknote,
  IconReceipt
} from '@tabler/icons-react'

interface MerchantDashboardLayoutProps {
  children: React.ReactNode
  params: {
    merchantId: string
  }
}

export default function MerchantDashboardLayout({ 
  children, 
  params 
}: MerchantDashboardLayoutProps) {
  const pathname = usePathname()
  const merchantId = params.merchantId
  
  // Navigation items
  const navItems = [
    {
      name: 'Dashboard',
      href: `/merchant/dashboard/${merchantId}`,
      icon: <IconHome size={20} />,
      exact: true
    },
    {
      name: 'Accounts',
      href: `/merchant/dashboard/${merchantId}/accounts`,
      icon: <IconReceipt size={20} />
    },
    {
      name: 'Yield',
      href: `/merchant/dashboard/${merchantId}/yield`,
      icon: <IconCoins size={20} />
    },
    {
      name: 'Off-Ramps',
      href: `/merchant/dashboard/${merchantId}/off-ramps`,
      icon: <IconCashBanknote size={20} />
    }
  ]
  
  // Function to check if a nav item is active
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Navigation Bar */}
      <div className="navbar bg-base-300 shadow-lg px-4">
        <div className="flex-1">
          <Link 
            href={`/merchant/dashboard/${merchantId}`} 
            className="text-xl font-bold"
          >
            GotSOL Merchant
          </Link>
        </div>
        <div className="flex-none">
          {/* Mobile menu button */}
          <div className="dropdown dropdown-end lg:hidden">
            <label tabIndex={0} className="btn btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </label>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-300 rounded-box w-52">
              {navItems.map((item) => (
                <li key={item.name}>
                  <Link 
                    href={item.href}
                    className={isActive(item.href, item.exact) ? 'active' : ''}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar Navigation (Desktop) */}
        <div className="hidden lg:block w-64 bg-base-200 min-h-screen p-4">
          <ul className="menu menu-lg p-0 [&_li>*]:rounded-lg">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link 
                  href={item.href}
                  className={isActive(item.href, item.exact) ? 'active font-medium' : ''}
                >
                  {item.icon}
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  )
} 