import { unstable_cache } from "next/cache"
import { eq, asc, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, speakers, segments, jobs } from "@/lib/db/schema"
import { episodeTag } from "@/lib/cache-tags"

export type EpisodePageData = {
  episode: typeof episodes.$inferSelect
  latestJob: typeof jobs.$inferSelect | null
  speakerRows: (typeof speakers.$inferSelect)[]
  segmentRows: (typeof segments.$inferSelect)[]
}

async function fetchEpisodeTranscript(episodeId: string) {
  const speakerRows = await db
    .select()
    .from(speakers)
    .where(eq(speakers.episodeId, episodeId))

  const segmentRows = await db
    .select()
    .from(segments)
    .where(eq(segments.episodeId, episodeId))
    .orderBy(asc(segments.seq))

  return { speakerRows, segmentRows }
}

function getCachedEpisodeTranscript(episodeId: string) {
  return unstable_cache(
    () => fetchEpisodeTranscript(episodeId),
    [`episode-transcript-${episodeId}`],
    { tags: [episodeTag(episodeId)] },
  )()
}

export async function loadEpisodePageData(
  episodeId: string,
): Promise<EpisodePageData | null> {
  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1)

  if (!episode) return null

  const [latestJob] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.episodeId, episodeId))
    .orderBy(desc(jobs.createdAt))
    .limit(1)

  const isTerminal =
    latestJob?.status === "completed" || latestJob?.status === "failed"

  if (isTerminal && latestJob?.status === "completed") {
    const { speakerRows, segmentRows } =
      await getCachedEpisodeTranscript(episodeId)
    return { episode, latestJob, speakerRows, segmentRows }
  }

  const { speakerRows, segmentRows } =
    await fetchEpisodeTranscript(episodeId)

  return { episode, latestJob: latestJob ?? null, speakerRows, segmentRows }
}

export async function getEpisodeTitle(
  episodeId: string,
): Promise<string | null> {
  const [episode] = await db
    .select({ title: episodes.title })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1)

  return episode?.title ?? null
}
