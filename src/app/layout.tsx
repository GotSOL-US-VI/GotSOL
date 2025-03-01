import './globals.css'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { SolanaProvider } from '@/components/solana/solana-provider'
import { UiLayout } from '@/components/ui/ui-layout'
import { ReactQueryProvider } from './react-query-provider'

export const metadata = {
  title: 'Kumbaya',
  description: 'Money -> copacetic.',
}

const links: { label: string; path: string }[] = [
  { label: 'Merchant Setup', path: '/merchant/setup' },
  { label: 'Accounts', path: '/account' },
  { label: 'Helpful Links', path: '/links' },
  // { label: 'Clusters', path: '/clusters' },
  // { label: 'Basic Program', path: '/basic' },
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
