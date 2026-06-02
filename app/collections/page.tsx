import { loadDashboardData } from "@/lib/load-dashboard-data"
import { CollectionsView } from "@/components/collections-view"

export default async function CollectionsPage() {
  const { initialEpisodes, collections } = await loadDashboardData()

  return (
    <CollectionsView episodes={initialEpisodes} collections={collections} />
  )
}
