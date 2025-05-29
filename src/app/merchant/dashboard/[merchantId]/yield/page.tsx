import YieldContent from './YieldContent'

// Server component
export default async function YieldPage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const resolvedParams = await params;
  return <YieldContent params={resolvedParams} />;
} 