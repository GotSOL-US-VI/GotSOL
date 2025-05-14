import "@getpara/react-sdk/styles.css";
import './globals.css'
import { ClientProviders, NavigationLink } from '@/components/providers/client-providers';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ExplorerLink } from '@/components/explorer-link';

export const metadata = {
  title: 'GotSOL - USDC Payments on Solana',
  description: 'Your gateway to seamless Solana payments. Accept USDC, manage transactions, and grow your business on Solana.',
}

// Define navigation links at the server level
const defaultLinks: NavigationLink[] = [
  { label: 'Create Merchant', path: '/merchant/setup' },
  { label: 'Inventory Management', path: '/inventory_management' },
  { label: 'Revenue Payments', path: '/tax_compliance' },
  { label: 'Treasury and Yield', path: '/yield' },
  { label: 'Swap', path: '/owner_yield' },
  { label: 'Project Phases', path: '/roadmap' },
  { label: 'Colosseum Hackathon Notes', path: '/hackathon_notes' },
]

const merchantLinks: NavigationLink[] = [
  { label: 'Point of Sale', path: '/merchant/dashboard/:merchantId' },
  { label: 'Inventory Management', path: '/merchant/dashboard/:merchantId/inventory_management' },
  { label: 'Revenue Payments', path: '/merchant/dashboard/:merchantId/tax_compliance' },
  { label: 'Treasury / Yield', path: '/merchant/dashboard/:merchantId/yield' },
  { label: 'USD On & Off-ramps', path: '/merchant/dashboard/:merchantId/off-ramps' },
  { label: 'Project Phases', path: '/merchant/dashboard/:merchantId/roadmap' },
  { label: <ExplorerLink />, path: '#' }
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {/* ClientProviders component will handle all client-side functionality */}
        <ClientProviders defaultLinks={defaultLinks} merchantLinks={merchantLinks}>
          {children}
        </ClientProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
