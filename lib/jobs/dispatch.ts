import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { submitJob } from "@/lib/runpod/client"

export interface DispatchJobInput {
  audio_url: string
  title: string
  source_type?: "direct" | "youtube"
  source_url?: string
  published_at?: string | null
  description?: string | null
  duration_secs?: number | null
  collection?: string | null
  batchId?: string | null
}

export interface DispatchJobResult {
  episodeId: string
  jobId: string
  runpodId: string | null
  dispatchFailed: boolean
}

function buildWebhookUrl(): string | undefined {
  const baseUrl = process.env.BASE_URL
  const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET
  if (!baseUrl || !webhookSecret) return undefined
  return `${baseUrl}/api/webhooks/runpod?token=${webhookSecret}`
}

export async function dispatchTranscriptionJob(
  input: DispatchJobInput,
): Promise<DispatchJobResult> {
  const sourceUrl = input.source_url ?? input.audio_url
  const sourceType = input.source_type ?? "direct"

  const [episode] = await db
    .insert(episodes)
    .values({
      sourceUrl,
      audioUrl: input.audio_url,
      title: input.title,
      description: input.description ?? null,
      publishedAt: input.published_at ? new Date(input.published_at) : null,
      durationSecs: input.duration_secs ?? null,
      collection: input.collection ?? null,
    })
    .onConflictDoUpdate({
      target: episodes.sourceUrl,
      set: {
        title: input.title,
        audioUrl: input.audio_url,
        description: input.description ?? undefined,
        publishedAt: input.published_at ? new Date(input.published_at) : undefined,
        durationSecs: input.duration_secs ?? undefined,
        collection: input.collection ?? undefined,
        updatedAt: new Date(),
      },
    })
    .returning({ id: episodes.id })

  const [job] = await db
    .insert(jobs)
    .values({
      episodeId: episode.id,
      batchId: input.batchId ?? null,
      status: "queued",
    })
    .returning({ id: jobs.id })

  const webhook = buildWebhookUrl()

  try {
    const runpodResult = await submitJob(
      { audio_url: input.audio_url, source_type: sourceType },
      webhook,
    )
    await db
      .update(jobs)
      .set({ runpodId: runpodResult.id })
      .where(eq(jobs.id, job.id))

    return {
      episodeId: episode.id,
      jobId: job.id,
      runpodId: runpodResult.id,
      dispatchFailed: false,
    }
  } catch (err) {
    console.error("RunPod submission failed:", err)
    await db
      .update(jobs)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(jobs.id, job.id))

    return {
      episodeId: episode.id,
      jobId: job.id,
      runpodId: null,
      dispatchFailed: true,
    }
  }
}
