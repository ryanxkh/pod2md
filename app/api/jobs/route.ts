import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { submitJob } from "@/lib/runpod/client"

const CreateJobBody = z.object({
  audio_url: z.url(),
  title: z.string().min(1),
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

  const { audio_url, title } = parsed.data

  try {
    // Upsert episode (source_url = audio_url for Phase 1)
    const [episode] = await db
      .insert(episodes)
      .values({ sourceUrl: audio_url, audioUrl: audio_url, title })
      .onConflictDoUpdate({
        target: episodes.sourceUrl,
        set: { title, audioUrl: audio_url, updatedAt: new Date() },
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
