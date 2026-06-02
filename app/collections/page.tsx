import { Suspense } from "react"
import { loadDashboardData } from "@/lib/load-dashboard-data"
import { CollectionsView } from "@/components/collections-view"
import { CollectionsSkeleton } from "@/components/collections-skeleton"

async function CollectionsData() {
  const { initialEpisodes, collections } = await loadDashboardData()

  return (
    <CollectionsView episodes={initialEpisodes} collections={collections} />
  )
}

export default function CollectionsPage() {
  return (
    <Suspense fallback={<CollectionsSkeleton />}>
      <CollectionsData />
    </Suspense>
  )
}
