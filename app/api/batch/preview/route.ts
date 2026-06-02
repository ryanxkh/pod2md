import { z } from "zod"
import { parseUrlList, resolveBatchUrls } from "@/lib/batch/resolve"

const PreviewBody = z.object({
  urls: z.array(z.string().min(1)).optional(),
  text: z.string().optional(),
  collection: z.string().optional(),
  latestN: z.number().int().min(1).max(25).optional(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = PreviewBody.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const latestN = parsed.data.latestN ?? 10
  const urlList =
    parsed.data.urls ??
    (parsed.data.text ? parseUrlList(parsed.data.text) : [])

  if (urlList.length === 0) {
    return Response.json({ error: "No URLs provided" }, { status: 400 })
  }

  try {
    const result = await resolveBatchUrls(urlList, latestN)
    return Response.json({
      items: result.items,
      counts: result.counts,
      errors: result.errors,
      capped: result.capped,
      capMessage: result.capMessage,
      collection: parsed.data.collection ?? null,
      latestN,
    })
  } catch (err) {
    console.error("Batch preview failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
