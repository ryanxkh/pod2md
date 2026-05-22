import { eq, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, speakers, segments } from "@/lib/db/schema"
import { generateTranscriptMarkdown } from "@/lib/markdown"

export async function regenerateTranscriptMarkdown(episodeId: string) {
  const [episode] = await db
    .select({ title: episodes.title })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1)

  if (!episode) return

  const speakerRows = await db
    .select({ id: speakers.id, label: speakers.label, name: speakers.name })
    .from(speakers)
    .where(eq(speakers.episodeId, episodeId))

  const speakerMap = new Map(
    speakerRows.map((s) => [s.id, s.name ?? s.label]),
  )

  const segmentRows = await db
    .select({
      startMs: segments.startMs,
      speakerId: segments.speakerId,
      text: segments.text,
    })
    .from(segments)
    .where(eq(segments.episodeId, episodeId))
    .orderBy(asc(segments.seq))

  const markdownSegments = segmentRows.map((seg) => ({
    start_ms: seg.startMs,
    speaker_name: speakerMap.get(seg.speakerId) ?? "Unknown",
    text: seg.text,
  }))

  const transcriptMd = generateTranscriptMarkdown(
    { title: episode.title },
    markdownSegments,
  )

  await db
    .update(episodes)
    .set({ transcriptMd, updatedAt: new Date() })
    .where(eq(episodes.id, episodeId))
}
