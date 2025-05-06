'use client'

import { PublicKey } from '@solana/web3.js'
import { useEffect, useState } from 'react'
import { useAnchorProvider, ParaAnchorProvider } from '@/components/para/para-provider'
import { Program, Idl } from '@coral-xyz/anchor'
import * as kumbayaIdl from '@/utils/kumbaya.json'
import { MakeRevenuePaymentButton } from '@/components/merchant/make-revenue-payment'
import { useConnection } from '@/lib/connection-context'

function TaxComplianceContent({ params }: { params: { merchantId: string } }) {
  const [mounted, setMounted] = useState(false)
  const [merchantName, setMerchantName] = useState<string>('')
  const [program, setProgram] = useState<Program<Idl> | null>(null)
  const provider = useAnchorProvider()
  const { connection } = useConnection()

  // Initialize program
  useEffect(() => {
    if (provider) {
      const programInstance = new Program(kumbayaIdl as Idl, provider)
      setProgram(programInstance)
    }
  }, [provider])

  // Fetch merchant data
  useEffect(() => {
    const fetchMerchantData = async () => {
      if (!program || !connection) return;
      
      try {
        const merchantId = new PublicKey(params.merchantId);
        const merchantAccount = await (program.account as any).merchant.fetch(merchantId);
        
        if (merchantAccount && merchantAccount.entityName) {
          // Convert the entity name from bytes to string
          const name = merchantAccount.entityName.toString();
          setMerchantName(name);
        }
      } catch (err) {
        console.error('Error fetching merchant data:', err);
      }
    };
    
    fetchMerchantData();
  }, [program, connection, params.merchantId]);

  // Client-side only to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !program) return null

  const merchantId = new PublicKey(params.merchantId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automate Tax Payments and Compliance for your Business (in development, currently non-functional)</h1>
          <br></br>
          <p>
          This Product Offering will be built in Phase 3, after Inventory Management is feature-complete, and we have more specifics on exactly what features and customization are required here.
          </p>
          <br></br>
          <p className="text-gray-500">
            This feature is modeled on the US Virgin Islands 5% tax on a business&apos;s monthly gross receipts.
            Different businesses will fall into different tax brackets, but for now we are mocking a tax burden of 5% of gross revenue, paid monthly.
            Here is how it works:
          </p>
          <br></br>
          <ul className="list-disc pl-5 space-y-2 text-gray-500">
            <li>
              When the Owner withdraws USDC from the Merchant&apos;s account, 5% of the withdrawal amount is deposited into a separate escrow dedicated to tax/compliance payments.
            </li>
            <li>
              The other 93.5% goes to the Merchant&apos;s Owner&apos;s USDC account, and 1.5% goes to the House&apos;s platform fee.
            </li>
            <li>The Merchant&apos;s compliance escrow continues to accrue USDC each time the Merchant&apos;s Owner withdraws from the Merchant&apos;s USDC account.</li>
            <li>
              Once the time comes to pay their monthly tax bill, the Owner can click the &quot;Make Revenue Payment&quot; button and 100% of the Merchant&apos;s compliance escrow will be paid to GOV&apos;s USDC account.
            </li>
            <li>This achieves a preliminary level of automation regarding the disbersion and allocation of revenues, while ensuring all 3 interested parties are either paid, or earmarked funds simultaneously (The Merchant&apos;s Owner, the House, and GOV).</li>
          </ul>
          <br></br>
          <p>We present this feature as a vision of what is possible. It is a starting point for discussions about the future of automated tax payments. This prototype demonstrates a streamlined approach that would benefit both merchants and tax authorities, assuming government departments establish accounts and embrace these methods. Our goal is to showcase the potential efficiency and transparency this system could bring to all stakeholders.</p>
        </div>
      </div>

      <div className="card bg-base-300 shadow-xl p-6">
        <h2 className="text-2xl font-bold mb-4">Make Revenue Payment</h2>
        <p className="mb-4">Use this button to pay your tax obligations from your compliance escrow&apos;s funds. Payments go directly to the relevant government entity&apos;s account, making compliance simple and transparent.</p>
        <MakeRevenuePaymentButton 
          program={program} 
          merchantPubkey={merchantId} 
          merchantName={merchantName || "Merchant"} 
        />
      </div>
    </div>
  )
}

export default function TaxCompliancePage({ params }: { params: { merchantId: string } }) {
  return (
    <ParaAnchorProvider>
      <TaxComplianceContent params={params} />
    </ParaAnchorProvider>
  );
} 