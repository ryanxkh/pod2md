import { eq, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { dispatchTranscriptionJob } from "@/lib/jobs/dispatch"
import { detectUrlType } from "@/lib/resolvers"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const [episode] = await db
      .select({
        id: episodes.id,
        title: episodes.title,
        audioUrl: episodes.audioUrl,
        sourceUrl: episodes.sourceUrl,
      })
      .from(episodes)
      .where(eq(episodes.id, id))
      .limit(1)

    if (!episode) {
      return Response.json({ error: "Episode not found" }, { status: 404 })
    }

    if (!episode.audioUrl) {
      return Response.json({ error: "Episode has no audio URL" }, { status: 400 })
    }

    const [latestJob] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.episodeId, id))
      .orderBy(desc(jobs.createdAt))
      .limit(1)

    if (
      latestJob &&
      latestJob.status !== "failed" &&
      latestJob.status !== "cancelled"
    ) {
      return Response.json(
        { error: "Only failed jobs can be retried" },
        { status: 409 },
      )
    }

    const sourceType =
      detectUrlType(episode.sourceUrl) === "youtube" ? "youtube" : "direct"

    const result = await dispatchTranscriptionJob({
      audio_url: episode.audioUrl,
      title: episode.title,
      source_type: sourceType,
      source_url: episode.sourceUrl,
    })

    if (result.dispatchFailed) {
      return Response.json(
        { error: "Failed to dispatch job to RunPod" },
        { status: 500 },
      )
    }

    return Response.json(
      { jobId: result.jobId, episodeId: id },
      { status: 201 },
    )
  } catch (err) {
    console.error("Retry failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
