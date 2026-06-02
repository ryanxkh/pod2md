import { Suspense } from "react"
import { loadDashboardData } from "@/lib/load-dashboard-data"
import { EpisodesPageClient } from "@/components/episodes-page-client"

export default async function EpisodesPage() {
  const { initialEpisodes, collections } = await loadDashboardData()

  return (
    <Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
      <EpisodesPageClient
        initialEpisodes={initialEpisodes}
        collections={collections}
      />
    </Suspense>
  )
}
