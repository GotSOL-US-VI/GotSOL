import "@getpara/react-sdk/styles.css";
import './globals.css'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { ParaProvider } from "@/components/para/para-provider";
import { UiLayout } from '@/components/ui/ui-layout'
import { ReactQueryProvider } from './react-query-provider'
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ConnectionProvider } from "@/lib/connection-provider";
import { ClientLayout } from '@/components/ui/client-layout';
import { ExplorerLink } from '@/components/explorer-link';
import { ReactNode } from 'react';

export const metadata = {
  title: 'GotSOL - USDC Payments on Solana',
  description: 'Your gateway to seamless Solana payments. Accept USDC, manage transactions, and grow your business on Solana.',
}

// const links: { label: string; path: string }[] = [
//   // { label: 'Create Store', path: '/merchant/setup' },
//   // { label: 'My Stores', path: '/merchants' },
//   // { label: 'Accounts', path: '/account' },
//   // { label: 'Yield', path: '/links' },
//   // { label: 'Resources', path: '/links' },
// ]

const defaultLinks = [
  { label: 'Create Merchant', path: '/merchant/setup' },
  // { label: 'Resources', path: '/links' },
  { label: 'Project Phases', path: '/roadmap' },
  { label: 'Owner\'s Yield Dashboard', path: '/owner_yield' },

]

interface MerchantLink {
  label: string | ReactNode;
  path: string;
}

const merchantLinks: MerchantLink[] = [
  { label: 'Point of Sale', path: '/merchant/dashboard/:merchantId' },
  { label: 'Inventory Management', path: '/merchant/dashboard/:merchantId/inventory_management' },
  { label: 'Revenue Payments', path: '/merchant/dashboard/:merchantId/tax_compliance' },
  // { label: 'Manage Employees', path: '/merchant/dashboard/:merchantId/accounts' },
  { label: 'Treasury / Yield', path: '/merchant/dashboard/:merchantId/yield' },
  { label: 'USD On & Off-ramps', path: '/merchant/dashboard/:merchantId/off-ramps' },
  // { label: 'Resources', path: '/merchant/dashboard/:merchantId/links' },
  { label: 'Project Phases', path: '/merchant/dashboard/:merchantId/roadmap' },
  { label: <ExplorerLink />, path: '#' }
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <ReactQueryProvider>
          <ClusterProvider>
            <ConnectionProvider>
              <ParaProvider>
                <ClientLayout>
                  <UiLayout defaultLinks={defaultLinks} merchantLinks={merchantLinks}>
                    {children}
                  </UiLayout>
                </ClientLayout>
              </ParaProvider>
            </ConnectionProvider>
          </ClusterProvider>
        </ReactQueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
