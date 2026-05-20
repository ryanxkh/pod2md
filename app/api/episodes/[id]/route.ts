import { eq, desc, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, speakers, segments, jobs } from "@/lib/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    // 1. Query episode by ID
    const [episode] = await db
      .select({
        id: episodes.id,
        title: episodes.title,
        sourceUrl: episodes.sourceUrl,
        durationSecs: episodes.durationSecs,
        transcriptMd: episodes.transcriptMd,
        createdAt: episodes.createdAt,
        updatedAt: episodes.updatedAt,
      })
      .from(episodes)
      .where(eq(episodes.id, id))
      .limit(1)

    if (!episode) {
      return Response.json({ error: "Episode not found" }, { status: 404 })
    }

    // 2. Fetch speakers for this episode
    const speakerRows = await db
      .select({
        id: speakers.id,
        label: speakers.label,
        name: speakers.name,
        confidence: speakers.confidence,
      })
      .from(speakers)
      .where(eq(speakers.episodeId, id))

    // 3. Build speaker lookup: speakerId → { label, name }
    const speakerMap = new Map(
      speakerRows.map((s) => [s.id, { label: s.label, name: s.name ?? s.label }]),
    )

    // 4. Fetch segments ordered by seq
    const segmentRows = await db
      .select({
        id: segments.id,
        startMs: segments.startMs,
        endMs: segments.endMs,
        speakerId: segments.speakerId,
        text: segments.text,
        seq: segments.seq,
      })
      .from(segments)
      .where(eq(segments.episodeId, id))
      .orderBy(asc(segments.seq))

    // 5. Fetch latest job for this episode
    const [latestJob] = await db
      .select({
        id: jobs.id,
        status: jobs.status,
        progress: jobs.progress,
        errorMessage: jobs.errorMessage,
      })
      .from(jobs)
      .where(eq(jobs.episodeId, id))
      .orderBy(desc(jobs.createdAt))
      .limit(1)

    return Response.json({
      episode: {
        id: episode.id,
        title: episode.title,
        source_url: episode.sourceUrl,
        duration_secs: episode.durationSecs,
        transcript_md: episode.transcriptMd,
        created_at: episode.createdAt,
        updated_at: episode.updatedAt,
      },
      speakers: speakerRows.map((s) => ({
        id: s.id,
        label: s.label,
        name: s.name ?? s.label,
        confidence: s.confidence,
      })),
      segments: segmentRows.map((seg) => {
        const speaker = speakerMap.get(seg.speakerId)
        return {
          id: seg.id,
          start_ms: seg.startMs,
          end_ms: seg.endMs,
          speaker_label: speaker?.label ?? "",
          speaker_name: speaker?.name ?? "",
          text: seg.text,
          seq: seg.seq,
        }
      }),
      job: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            progress: latestJob.progress,
            error_message: latestJob.errorMessage,
          }
        : null,
    })
  } catch (err) {
    console.error("Episode fetch failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
