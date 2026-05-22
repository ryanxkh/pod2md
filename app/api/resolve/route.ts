import { z } from "zod"
import {
  detectUrlType,
  resolveRss,
  resolveApple,
} from "@/lib/resolvers"

const ResolveBody = z.object({
  url: z.url(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = ResolveBody.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { url } = parsed.data
  const urlType = detectUrlType(url)

  if (urlType === "direct") {
    return Response.json({ type: "direct", url })
  }

  try {
    const result =
      urlType === "apple" ? await resolveApple(url) : await resolveRss(url)

    return Response.json({
      type: "feed",
      podcastTitle: result.podcastTitle,
      episodes: result.episodes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 422 })
  }
}
