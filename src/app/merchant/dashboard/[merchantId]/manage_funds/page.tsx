import { ParaAnchorProvider } from '@/components/para/para-provider'
import ManageFundsContent from './ManageFundsContent'

// Server component
export default async function ManageFundsPage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const { merchantId } = await params;
  return (
    <ParaAnchorProvider>
      <ManageFundsContent params={{ merchantId }} />
    </ParaAnchorProvider>
  );
} 