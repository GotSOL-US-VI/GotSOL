import { ParaAnchorProvider } from '@/components/para/para-provider';
import DashboardContent from './DashboardContent';

// Server component
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const { merchantId } = await params;
  return (
    <ParaAnchorProvider>
      <DashboardContent params={{ merchantId }} />
    </ParaAnchorProvider>
  );
} 