import { eq, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { submitJob } from "@/lib/runpod/client"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const [episode] = await db
      .select({ id: episodes.id, audioUrl: episodes.audioUrl })
      .from(episodes)
      .where(eq(episodes.id, id))
      .limit(1)

    if (!episode) {
      return Response.json({ error: "Episode not found" }, { status: 404 })
    }

    if (!episode.audioUrl) {
      return Response.json({ error: "Episode has no audio URL" }, { status: 400 })
    }

    // Verify latest job is failed
    const [latestJob] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.episodeId, id))
      .orderBy(desc(jobs.createdAt))
      .limit(1)

    if (latestJob && latestJob.status !== "failed") {
      return Response.json(
        { error: "Only failed jobs can be retried" },
        { status: 409 },
      )
    }

    // Create new job row
    const [job] = await db
      .insert(jobs)
      .values({ episodeId: id, status: "queued" })
      .returning({ id: jobs.id })

    // Dispatch to RunPod
    const baseUrl = process.env.BASE_URL
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET
    const webhook =
      baseUrl && webhookSecret
        ? `${baseUrl}/api/webhooks/runpod?token=${webhookSecret}`
        : undefined

    let runpodResult: { id: string }
    try {
      runpodResult = await submitJob(
        { audio_url: episode.audioUrl, source_type: "direct" },
        webhook,
      )
    } catch (err) {
      console.error("RunPod submission failed:", err)
      await db
        .update(jobs)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eq(jobs.id, job.id))
      return Response.json(
        { error: "Failed to dispatch job to RunPod" },
        { status: 500 },
      )
    }

    await db
      .update(jobs)
      .set({ runpodId: runpodResult.id })
      .where(eq(jobs.id, job.id))

    return Response.json(
      { jobId: job.id, episodeId: id },
      { status: 201 },
    )
  } catch (err) {
    console.error("Retry failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
