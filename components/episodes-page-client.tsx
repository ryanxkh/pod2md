"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import { Dashboard } from "@/components/dashboard"
import type { EpisodeRow } from "@/components/episode-list"

interface EpisodesPageClientProps {
  initialEpisodes: EpisodeRow[]
  collections: string[]
}

export function EpisodesPageClient({
  initialEpisodes,
  collections,
}: EpisodesPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const collectionFilter = useMemo(() => {
    const c = searchParams.get("collection")
    return c && c.length > 0 ? c : null
  }, [searchParams])

  const setCollectionFilter = useCallback(
    (filter: string | null) => {
      if (filter) {
        router.push(
          `${pathname}?collection=${encodeURIComponent(filter)}`,
        )
      } else {
        router.push(pathname)
      }
    },
    [router, pathname],
  )

  return (
    <Dashboard
      initialEpisodes={initialEpisodes}
      collections={collections}
      showSubmit={false}
      collectionFilter={collectionFilter}
      onCollectionFilterChange={setCollectionFilter}
    />
  )
}
