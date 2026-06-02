import { connection } from "next/server"
import { desc, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { Dashboard } from "@/components/dashboard"
import type { EpisodeRow } from "@/components/episode-list"

export default async function Home() {
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

  const initial: EpisodeRow[] = episodeRows.map((row) => {
    const job = jobByEpisode.get(row.id)
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      status: job?.status ?? "completed",
      collection: row.collection,
      batchId: job?.batchId ?? null,
    }
  })

  const collectionRows = await db
    .selectDistinct({ collection: episodes.collection })
    .from(episodes)
    .where(isNotNull(episodes.collection))

  const collections = [...new Set(
    collectionRows
      .map((r) => r.collection)
      .filter((c): c is string => c != null),
  )].sort()

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-6 py-16">
      <h1 className="font-mono text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        pod2md
      </h1>
      <Dashboard initialEpisodes={initial} collections={collections} />
    </div>
  )
}
