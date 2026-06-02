import { z } from "zod"
import { dispatchTranscriptionJob } from "@/lib/jobs/dispatch"

const CreateJobBody = z.object({
  audio_url: z.url(),
  title: z.string().min(1),
  source_type: z.enum(["direct", "youtube"]).default("direct"),
  source_url: z.url().optional(),
  published_at: z.string().optional(),
  description: z.string().optional(),
  duration_secs: z.number().optional(),
  collection: z.string().optional(),
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

  const {
    audio_url,
    title,
    source_type,
    source_url,
    published_at,
    description,
    duration_secs,
    collection,
  } = parsed.data

  try {
    const result = await dispatchTranscriptionJob({
      audio_url,
      title,
      source_type,
      source_url,
      published_at: published_at ?? null,
      description: description ?? null,
      duration_secs: duration_secs ?? null,
      collection: collection?.trim() || null,
    })

    if (result.dispatchFailed) {
      return Response.json(
        { error: "Failed to dispatch job to RunPod" },
        { status: 500 },
      )
    }

    return Response.json(
      { jobId: result.jobId, episodeId: result.episodeId },
      { status: 201 },
    )
  } catch (err) {
    console.error("Job creation failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
