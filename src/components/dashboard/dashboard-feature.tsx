'use client'

import { useDashboardData } from './dashboard-data-access'
import { DashboardContent, DashboardHero } from './dashboard-ui'

/**
 * Main dashboard feature component
 * Connects the data layer with the UI layer
 */
export default function DashboardFeature() {
  // Use the data access layer to get all dashboard data
  const { isConnected, merchants, loading, error } = useDashboardData()

  // Render hero section when not connected
  if (!isConnected) {
    return <DashboardHero subtitle="Connect your account to start." />
  }

  // Pass loading state and data to the UI components
  return <DashboardContent isLoading={loading} merchants={merchants} error={error} />
}
