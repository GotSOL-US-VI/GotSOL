import { ParaAnchorProvider } from '@/components/para/para-provider';
import ManageFundsContent from '@/app/merchant/dashboard/[merchantId]/manage_funds/ManageFundsContent';

export default async function Page({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  return (
    <ParaAnchorProvider>
      <ManageFundsContent merchantId={merchantId} />
    </ParaAnchorProvider>
  );
} 