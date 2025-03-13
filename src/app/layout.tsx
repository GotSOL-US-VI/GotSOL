import './globals.css'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { SolanaProvider } from '@/components/solana/solana-provider'
import { UiLayout } from '@/components/ui/ui-layout'
import { ReactQueryProvider } from './react-query-provider'

export const metadata = {
  title: 'Got Sol - Solana Payments Made Easy',
  description: 'Your gateway to seamless Solana payments. Accept USDC, manage transactions, and grow your business on Solana.',
}

const links: { label: string; path: string }[] = [
  { label: 'Create Store', path: '/merchant/setup' },
  // { label: 'My Stores', path: '/merchants' },
  { label: 'Accounts', path: '/account' },
  { label: 'Resources', path: '/links' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <ClusterProvider>
            <SolanaProvider>
              <UiLayout links={links}>{children}</UiLayout>
            </SolanaProvider>
          </ClusterProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
