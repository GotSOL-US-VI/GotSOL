import DashboardFeature from './dashboard-feature'
import { Suspense } from 'react'

// Server component wrapper for the dashboard
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
      <DashboardFeature />
    </Suspense>
  )
} 