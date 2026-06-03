import { eq, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, speakers, segments } from "@/lib/db/schema"
import { resolveSpeakerNames } from "@/lib/speakers/resolve"
import { applySpeakerResolution } from "@/lib/speakers/apply-results"

export const maxDuration = 300

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: episodeId } = await params

  try {
    const [episode] = await db
      .select({ id: episodes.id, title: episodes.title })
      .from(episodes)
      .where(eq(episodes.id, episodeId))
      .limit(1)

    if (!episode) {
      return Response.json({ error: "Episode not found" }, { status: 404 })
    }

    const speakerRows = await db
      .select({ id: speakers.id, label: speakers.label })
      .from(speakers)
      .where(eq(speakers.episodeId, episodeId))

    const segmentRows = await db
      .select({
        speakerId: segments.speakerId,
        text: segments.text,
        seq: segments.seq,
      })
      .from(segments)
      .where(eq(segments.episodeId, episodeId))
      .orderBy(asc(segments.seq))

    const results = await resolveSpeakerNames(
      episode.title,
      speakerRows,
      segmentRows,
    )

    await applySpeakerResolution(episodeId, results)

    const updatedSpeakers = await db
      .select({
        id: speakers.id,
        label: speakers.label,
        name: speakers.name,
        confidence: speakers.confidence,
      })
      .from(speakers)
      .where(eq(speakers.episodeId, episodeId))

    return Response.json({
      speakers: updatedSpeakers.map((s) => ({
        id: s.id,
        label: s.label,
        name: s.name ?? s.label,
        confidence: s.confidence,
      })),
    })
  } catch (err) {
    console.error("Speaker resolution failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
