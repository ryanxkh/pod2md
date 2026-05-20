import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { Dashboard } from "@/components/dashboard"
import type { EpisodeRow } from "@/components/episode-list"

export default async function Home() {
  const rows = await db
    .select({
      id: episodes.id,
      title: episodes.title,
      createdAt: episodes.createdAt,
      jobStatus: jobs.status,
    })
    .from(episodes)
    .leftJoin(jobs, eq(jobs.episodeId, episodes.id))
    .orderBy(desc(episodes.createdAt))
    .limit(50)

  // Deduplicate: keep the latest job status per episode
  const seen = new Set<string>()
  const initial: EpisodeRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    initial.push({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      status: row.jobStatus ?? "completed",
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-6 py-16">
      <h1 className="font-mono text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        pod2md
      </h1>
      <Dashboard initialEpisodes={initial} />
    </div>
  )
}
