import { unstable_cache } from "next/cache"
import { desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { EPISODES_LIST_TAG } from "@/lib/cache-tags"

export type RecentEpisodeListItem = {
  id: string
  title: string
  collection: string | null
  status: string
  batchId: string | null
  createdAt: string
}

async function fetchRecentEpisodes(): Promise<RecentEpisodeListItem[]> {
  const latestJobs = await db
    .selectDistinctOn([jobs.episodeId], {
      episodeId: jobs.episodeId,
      status: jobs.status,
      batchId: jobs.batchId,
    })
    .from(jobs)
    .orderBy(jobs.episodeId, desc(jobs.createdAt))

  const jobByEpisode = new Map(
    latestJobs.map((j) => [
      j.episodeId,
      { status: j.status, batchId: j.batchId },
    ]),
  )

  const episodeRows = await db
    .select({
      id: episodes.id,
      title: episodes.title,
      collection: episodes.collection,
      createdAt: episodes.createdAt,
    })
    .from(episodes)
    .orderBy(desc(episodes.createdAt))
    .limit(100)

  return episodeRows.map((row) => {
    const job = jobByEpisode.get(row.id)
    return {
      id: row.id,
      title: row.title,
      collection: row.collection,
      status: job?.status ?? "completed",
      batchId: job?.batchId ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  })
}

const getCachedRecentEpisodes = unstable_cache(
  fetchRecentEpisodes,
  ["recent-episodes"],
  { tags: [EPISODES_LIST_TAG] },
)

export async function listRecentEpisodes(): Promise<RecentEpisodeListItem[]> {
  return getCachedRecentEpisodes()
}
