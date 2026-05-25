import { connection } from "next/server"
import { desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes } from "@/lib/db/schema"
import { Dashboard } from "@/components/dashboard"
import type { EpisodeRow } from "@/components/episode-list"

export default async function Home() {
  await connection()

  const rows = await db
    .select({
      id: episodes.id,
      title: episodes.title,
      createdAt: episodes.createdAt,
      jobStatus: sql<string | null>`(
        SELECT j.status FROM jobs j
        WHERE j.episode_id = ${episodes.id}
        ORDER BY j.created_at DESC
        LIMIT 1
      )`,
    })
    .from(episodes)
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
