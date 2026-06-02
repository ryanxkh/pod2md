import { connection } from "next/server"
import { isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes } from "@/lib/db/schema"
import type { EpisodeRow } from "@/components/episode-list"
import { listRecentEpisodes } from "@/lib/list-recent-episodes"

export async function loadDashboardData(): Promise<{
  initialEpisodes: EpisodeRow[]
  collections: string[]
}> {
  await connection()

  const recent = await listRecentEpisodes()

  const initial: EpisodeRow[] = recent.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    status: row.status,
    collection: row.collection,
    batchId: row.batchId,
  }))

  const collectionRows = await db
    .selectDistinct({ collection: episodes.collection })
    .from(episodes)
    .where(isNotNull(episodes.collection))

  const collections = [
    ...new Set(
      collectionRows
        .map((r) => r.collection)
        .filter((c): c is string => c != null),
    ),
  ].sort()

  return { initialEpisodes: initial, collections }
}
