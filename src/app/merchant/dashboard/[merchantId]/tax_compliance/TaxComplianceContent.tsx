'use client'

import { AppHero } from '@/components/ui/ui-layout'

interface TaxComplianceContentProps {
  params: {
    merchantId: string;
  };
}

export default function TaxComplianceContent({ params }: TaxComplianceContentProps) {
  return (
    <div className="relative">
      <AppHero
        title={<h1 className="text-4xl font-bold hero-gradient-text">Tax Compliance</h1>}
        subtitle={<p className="text-xl font-medium mt-4">Manage your tax compliance and reporting</p>}
      />
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="card bg-base-300 p-6">
          <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
          <p className="text-sm opacity-70">
            Tax compliance features will be implemented in a future phase. This will include:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm opacity-70">
            <li>Transaction history and reporting</li>
            <li>Tax document generation</li>
            <li>Compliance status tracking</li>
            <li>Integration with accounting software</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 