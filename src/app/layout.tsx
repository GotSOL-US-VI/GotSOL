import "@getpara/react-sdk/styles.css";
import './globals.css'
import { ClientProviders, NavigationLink } from '@/components/providers/client-providers';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ExplorerLink } from '@/components/explorer-link';

export const metadata = {
  title: 'GotSOL - Merchant Point of Sale and financial tool suite',
  description: 'Your gateway to seamless Solana payments. Accept USDC, manage transactions, and grow your business on Solana.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

// Add this at the top level (outside metadata)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Define navigation links at the server level
const defaultLinks: NavigationLink[] = [
  { label: 'Create Merchant', path: '/merchant/setup' },
  // { label: 'Inventory', path: '/inventory_management' },
  // { label: 'Revenue', path: '/tax_compliance' },
  { label: 'Portfolio', path: '/portfolio' },
  // { label: 'Swap', path: '/_owner_jup-terminal' },
  { label: 'Roadmap', path: '/roadmap' },
  // { label: 'Colosseum Hackathon Notes', path: '/hackathon_notes' },
  // { label: 'Test Supabase', path: '/test-supabase' },
]

const merchantLinks: NavigationLink[] = [
  { label: 'Point of Sale', path: '/merchant/dashboard/:merchantId' },
  { label: 'Manage Funds', path: '/merchant/dashboard/:merchantId/manage_funds' },
  { label: 'Inventory', path: '/merchant/dashboard/:merchantId/inventory_management' },
  { label: 'Treasury', path: '/merchant/dashboard/:merchantId/treasury' },
  // { label: 'Withdraw USD', path: '/merchant/dashboard/:merchantId/off-ramps' },
  // { label: 'Roadmap', path: '/merchant/dashboard/:merchantId/roadmap' },
  { label: <ExplorerLink />, path: '#' }
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="application-name" content="GotSOL" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GotSOL" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" type="image/png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
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
