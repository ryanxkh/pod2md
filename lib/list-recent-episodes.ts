import { connection } from "next/server"
import { desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"

export type RecentEpisodeListItem = {
  id: string
  title: string
  collection: string | null
  status: string
  createdAt: string
}

export async function listRecentEpisodes(): Promise<RecentEpisodeListItem[]> {
  await connection()

  const latestJobs = await db
    .selectDistinctOn([jobs.episodeId], {
      episodeId: jobs.episodeId,
      status: jobs.status,
    })
    .from(jobs)
    .orderBy(jobs.episodeId, desc(jobs.createdAt))

  const jobByEpisode = new Map(
    latestJobs.map((j) => [j.episodeId, j.status]),
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

  return episodeRows.map((row) => ({
    id: row.id,
    title: row.title,
    collection: row.collection,
    status: jobByEpisode.get(row.id) ?? "completed",
    createdAt: row.createdAt.toISOString(),
  }))
}
