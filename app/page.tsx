import { connection } from "next/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { Dashboard } from "@/components/dashboard"
import type { EpisodeRow } from "@/components/episode-list"

export default async function Home() {
  await connection()

  const latestJobs = db
    .selectDistinctOn([jobs.episodeId], {
      episodeId: jobs.episodeId,
      status: jobs.status,
    })
    .from(jobs)
    .orderBy(jobs.episodeId, desc(jobs.createdAt))
    .as("latest_jobs")

  const rows = await db
    .select({
      id: episodes.id,
      title: episodes.title,
      createdAt: episodes.createdAt,
      jobStatus: latestJobs.status,
    })
    .from(episodes)
    .leftJoin(latestJobs, eq(latestJobs.episodeId, episodes.id))
    .orderBy(desc(episodes.createdAt))
    .limit(50)

  const initial: EpisodeRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    status: row.jobStatus ?? "completed",
  }))

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-6 py-16">
      <h1 className="font-mono text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        pod2md
      </h1>
      <Dashboard initialEpisodes={initial} />
    </div>
  )
}
