import './globals.css'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { SolanaProvider } from '@/components/solana/solana-provider'
import { UiLayout } from '@/components/ui/ui-layout'
import { ReactQueryProvider } from './react-query-provider'

export const metadata = {
  title: 'Got Sol - Solana Payments Made Easy',
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
  { label: 'Create Store', path: '/merchant/setup' },
  { label: 'Resources', path: '/links' },
]

const merchantLinks = [
  { label: 'Point of Sale', path: '/merchant/dashboard/:merchantId' },
  { label: 'Manage Accounts', path: '/account' },
  { label: 'Yield', path: '/merchant/dashboard/:merchantId/yield' },
  { label: 'Resources', path: '/links' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <ClusterProvider>
            <SolanaProvider>
              <UiLayout defaultLinks={defaultLinks} merchantLinks={merchantLinks}>{children}</UiLayout>
            </SolanaProvider>
          </ClusterProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
