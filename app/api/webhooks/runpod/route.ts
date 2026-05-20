import { z } from "zod"
import { eq } from "drizzle-orm"
import { db, dbPool } from "@/lib/db"
import { jobs, speakers, segments, episodes } from "@/lib/db/schema"
import { generateTranscriptMarkdown } from "@/lib/markdown"

// ── Zod schemas ──────────────────────────────────────────────────────────────

const ProgressPayload = z.object({
  id: z.string(),
  status: z.literal("RUNNING"),
  output: z.object({
    stage: z.string(),
    progress: z.number(),
  }),
})

const SegmentSchema = z.object({
  start_ms: z.number(),
  end_ms: z.number(),
  speaker_label: z.string(),
  speaker_name: z.string(),
  text: z.string(),
})

const SpeakerSchema = z.object({
  label: z.string(),
  name: z.string(),
  confidence: z.string(),
})

const CompletedPayload = z.object({
  id: z.string(),
  status: z.literal("COMPLETED"),
  output: z.object({
    segments: z.array(SegmentSchema),
    speakers: z.array(SpeakerSchema),
    metadata: z.object({
      duration_secs: z.number(),
      segment_count: z.number(),
      model: z.string(),
      language: z.string(),
    }),
  }),
})

const FailedPayload = z.object({
  id: z.string(),
  status: z.enum(["FAILED", "CANCELLED", "TIMED_OUT"]),
  error: z.string().optional(),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function verifyToken(request: Request): boolean {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const secret = process.env.RUNPOD_WEBHOOK_SECRET
  if (!secret || !token) return false
  return token === secret
}

async function findJobByRunpodId(runpodId: string) {
  const rows = await db
    .select({ id: jobs.id, episodeId: jobs.episodeId, startedAt: jobs.startedAt })
    .from(jobs)
    .where(eq(jobs.runpodId, runpodId))
    .limit(1)
  return rows[0] ?? null
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleProgress(payload: z.infer<typeof ProgressPayload>) {
  const job = await findJobByRunpodId(payload.id)
  if (!job) {
    console.error(`Webhook: no job found for runpod_id=${payload.id}`)
    return
  }

  const updates: Record<string, unknown> = {
    status: payload.output.stage,
    progress: payload.output.progress,
  }
  if (!job.startedAt) {
    updates.startedAt = new Date()
  }

  await db.update(jobs).set(updates).where(eq(jobs.id, job.id))
}

async function handleCompleted(payload: z.infer<typeof CompletedPayload>) {
  const job = await findJobByRunpodId(payload.id)
  if (!job) {
    console.error(`Webhook: no job found for runpod_id=${payload.id}`)
    return
  }

  const { output } = payload

  await dbPool.transaction(async (tx) => {
    // 1. Insert speakers, collect label → id mapping
    const labelToId = new Map<string, string>()
    for (const spk of output.speakers) {
      const [inserted] = await tx
        .insert(speakers)
        .values({
          episodeId: job.episodeId,
          label: spk.label,
          name: spk.name,
          confidence: spk.confidence,
        })
        .returning({ id: speakers.id })
      labelToId.set(spk.label, inserted.id)
    }

    // 2. Insert segments
    for (let i = 0; i < output.segments.length; i++) {
      const seg = output.segments[i]
      const speakerId = labelToId.get(seg.speaker_label)
      if (!speakerId) {
        console.error(`Webhook: unknown speaker_label=${seg.speaker_label}`)
        continue
      }
      await tx.insert(segments).values({
        episodeId: job.episodeId,
        speakerId,
        startMs: seg.start_ms,
        endMs: seg.end_ms,
        text: seg.text,
        seq: i,
      })
    }

    // 3. Fetch episode title for markdown
    const [episode] = await tx
      .select({ title: episodes.title })
      .from(episodes)
      .where(eq(episodes.id, job.episodeId))
      .limit(1)

    // 4. Generate markdown
    const markdownSegments = output.segments.map((seg) => ({
      start_ms: seg.start_ms,
      speaker_name: seg.speaker_name,
      text: seg.text,
    }))
    const transcriptMd = generateTranscriptMarkdown(
      { title: episode.title },
      markdownSegments,
    )

    // 5. Update episode
    await tx
      .update(episodes)
      .set({
        transcriptMd,
        durationSecs: output.metadata.duration_secs,
        updatedAt: new Date(),
      })
      .where(eq(episodes.id, job.episodeId))

    // 6. Update job
    await tx
      .update(jobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        progress: 100,
      })
      .where(eq(jobs.id, job.id))
  })
}

async function handleFailed(payload: z.infer<typeof FailedPayload>) {
  const job = await findJobByRunpodId(payload.id)
  if (!job) {
    console.error(`Webhook: no job found for runpod_id=${payload.id}`)
    return
  }

  const status = payload.status === "CANCELLED" ? "cancelled" : "failed"
  await db
    .update(jobs)
    .set({
      status,
      errorMessage: payload.error ?? `Job ${payload.status.toLowerCase()}`,
      completedAt: new Date(),
    })
    .where(eq(jobs.id, job.id))
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    console.error("Webhook: invalid JSON body")
    return Response.json({ ok: true })
  }

  try {
    // Determine payload type by status field
    const statusField = (body as Record<string, unknown>)?.status

    if (statusField === "RUNNING") {
      const parsed = ProgressPayload.parse(body)
      await handleProgress(parsed)
    } else if (statusField === "COMPLETED") {
      const parsed = CompletedPayload.parse(body)
      await handleCompleted(parsed)
    } else if (
      statusField === "FAILED" ||
      statusField === "CANCELLED" ||
      statusField === "TIMED_OUT"
    ) {
      const parsed = FailedPayload.parse(body)
      await handleFailed(parsed)
    } else {
      console.error(`Webhook: unknown status=${String(statusField)}`)
    }
  } catch (err) {
    console.error("Webhook processing error:", err)
  }

  return Response.json({ ok: true })
}
