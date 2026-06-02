import { z } from "zod"
import { nanoid } from "nanoid"
import { eq, inArray, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import { dispatchTranscriptionJob } from "@/lib/jobs/dispatch"
import type { BatchResolvedItem } from "@/lib/batch/types"

export const maxDuration = 120

const BatchItemSchema = z.object({
  title: z.string().min(1),
  audio_url: z.url(),
  source_url: z.url(),
  source_type: z.enum(["direct", "youtube"]),
  published_at: z.string().nullable(),
  description: z.string().nullable(),
  duration_secs: z.number().nullable(),
  disposition: z.enum(["new", "skipped"]),
  input_url: z.string(),
  show: z.string().nullable().optional(),
})

const SubmitBody = z.object({
  items: z.array(BatchItemSchema).min(1),
  collection: z.string().optional(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = SubmitBody.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const batchId = nanoid()
  const collection = parsed.data.collection?.trim() || null

  const sourceUrls = parsed.data.items.map((i) => i.source_url)
  const completedUrls = await loadCompletedSourceUrls(sourceUrls)

  const toQueue = parsed.data.items.filter(
    (item) =>
      item.disposition === "new" && !completedUrls.has(item.source_url),
  ) as BatchResolvedItem[]

  let queued = 0
  let failed = 0
  const queuedEpisodes: Array<{ id: string; title: string }> = []

  for (const item of toQueue) {
    const result = await dispatchTranscriptionJob({
      audio_url: item.audio_url,
      title: item.title,
      source_type: item.source_type,
      source_url: item.source_url,
      published_at: item.published_at,
      description: item.description,
      duration_secs: item.duration_secs,
      collection,
      show: item.show ?? null,
      batchId,
    })

    queuedEpisodes.push({ id: result.episodeId, title: item.title })
    if (result.dispatchFailed) failed++
    else queued++
  }

  return Response.json(
    {
      batchId,
      queued,
      failed,
      skipped: parsed.data.items.length - toQueue.length,
      episodeIds: queuedEpisodes.map((e) => e.id),
      episodes: queuedEpisodes,
      collection,
    },
    { status: 201 },
  )
}

async function loadCompletedSourceUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set()

  const rows = await db
    .select({
      sourceUrl: episodes.sourceUrl,
      status: jobs.status,
    })
    .from(episodes)
    .innerJoin(jobs, eq(jobs.episodeId, episodes.id))
    .where(inArray(episodes.sourceUrl, urls))
    .orderBy(desc(jobs.createdAt))

  const completed = new Set<string>()
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.sourceUrl)) continue
    seen.add(row.sourceUrl)
    if (row.status === "completed") completed.add(row.sourceUrl)
  }
  return completed
}
