import { ParaAnchorProvider } from '@/components/para/para-provider'
import TaxComplianceContent from './TaxComplianceContent'

// Server component
export default async function TaxCompliancePage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const resolvedParams = await params;
  return (
    <ParaAnchorProvider>
      <TaxComplianceContent params={{ merchantId: resolvedParams.merchantId }} />
    </ParaAnchorProvider>
  );
} 