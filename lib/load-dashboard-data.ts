import { connection } from "next/server"
import { desc, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import type { EpisodeRow } from "@/components/episode-list"
import { listRecentEpisodes } from "@/lib/list-recent-episodes"

export async function loadDashboardData(): Promise<{
  initialEpisodes: EpisodeRow[]
  collections: string[]
}> {
  await connection()

  const latestJobs = await db
    .selectDistinctOn([jobs.episodeId], {
      episodeId: jobs.episodeId,
      status: jobs.status,
      batchId: jobs.batchId,
    })
    .from(jobs)
    .orderBy(jobs.episodeId, desc(jobs.createdAt))

  const jobByEpisode = new Map(
    latestJobs.map((j) => [j.episodeId, j]),
  )

  const recent = await listRecentEpisodes()

  const initial: EpisodeRow[] = recent.map((row) => {
    const job = jobByEpisode.get(row.id)
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      status: row.status,
      collection: row.collection,
      batchId: job?.batchId ?? null,
    }
  })

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
