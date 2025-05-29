import ManageInventoryClient from './ManageInventoryClient'

export default async function ManageInventoryPage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const { merchantId } = await params
  return <ManageInventoryClient merchantId={merchantId} />
} 