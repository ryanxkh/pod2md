import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { submitJob } from "@/lib/runpod/client"
import { normalizeSourceUrl } from "@/lib/url"

const CreateJobBody = z.object({
  audio_url: z.url(),
  title: z.string().min(1),
  source_url: z.url().optional(),
  published_at: z.string().optional(),
  description: z.string().optional(),
  duration_secs: z.number().optional(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = CreateJobBody.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { audio_url, title, source_url, published_at, description, duration_secs } = parsed.data
  const sourceUrl = normalizeSourceUrl(source_url ?? audio_url)

  try {
    // Reject resubmission if a completed transcript already exists
    const [existing] = await db
      .select({ id: episodes.id, transcriptMd: episodes.transcriptMd })
      .from(episodes)
      .where(eq(episodes.sourceUrl, sourceUrl))
      .limit(1)

    if (existing?.transcriptMd) {
      return Response.json(
        { error: "This episode already has a completed transcript" },
        { status: 409 },
      )
    }

    const [episode] = await db
      .insert(episodes)
      .values({
        sourceUrl,
        audioUrl: audio_url,
        title,
        description: description ?? null,
        publishedAt: published_at ? new Date(published_at) : null,
        durationSecs: duration_secs ?? null,
      })
      .onConflictDoUpdate({
        target: episodes.sourceUrl,
        set: {
          title,
          audioUrl: audio_url,
          description: description ?? undefined,
          publishedAt: published_at ? new Date(published_at) : undefined,
          durationSecs: duration_secs ?? undefined,
          updatedAt: new Date(),
        },
      })
      .returning({ id: episodes.id })

    // Create job row with status queued
    const [job] = await db
      .insert(jobs)
      .values({ episodeId: episode.id, status: "queued" })
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
        { audio_url, source_type: "direct" },
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

    // Store runpod_id on job row
    await db
      .update(jobs)
      .set({ runpodId: runpodResult.id })
      .where(eq(jobs.id, job.id))

    return Response.json(
      { jobId: job.id, episodeId: episode.id },
      { status: 201 },
    )
  } catch (err) {
    console.error("Job creation failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
