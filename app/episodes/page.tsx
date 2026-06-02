import { Suspense } from "react"
import { loadDashboardData } from "@/lib/load-dashboard-data"
import { EpisodesPageClient } from "@/components/episodes-page-client"
import { EpisodeListSkeleton } from "@/components/episode-list-skeleton"

async function EpisodesData() {
  const { initialEpisodes, collections } = await loadDashboardData()

  return (
    <EpisodesPageClient
      initialEpisodes={initialEpisodes}
      collections={collections}
    />
  )
}

export default function EpisodesPage() {
  return (
    <Suspense fallback={<EpisodeListSkeleton />}>
      <EpisodesData />
    </Suspense>
  )
}
