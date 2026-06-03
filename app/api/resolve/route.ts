import { z } from "zod"
import {
  detectUrlType,
  resolveRss,
  resolveApple,
  resolveSpotify,
  resolveYouTube,
} from "@/lib/resolvers"

const ResolveBody = z.object({
  url: z.url(),
})

const FEED_FALLBACK_NOTICE =
  "Couldn't isolate that exact episode — pick it from the feed below."

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
    if (urlType === "youtube") {
      const result = await resolveYouTube(url)
      return Response.json({
        type: "youtube",
        url: result.url,
        title: result.title,
        channelName: result.channelName,
      })
    }

    let result
    if (urlType === "spotify") {
      result = await resolveSpotify(url)
    } else if (urlType === "apple") {
      result = await resolveApple(url)
    } else {
      result = await resolveRss(url)
    }

    const matched = result.matchedEpisode
    if (
      result.singleEpisode &&
      matched?.audioUrl
    ) {
      return Response.json({
        type: "episode",
        podcastTitle: result.podcastTitle,
        episode: {
          title: matched.title,
          audioUrl: matched.audioUrl,
          publishedAt: matched.publishedAt,
          description: matched.description,
          durationSecs: matched.durationSecs,
        },
      })
    }

    const payload: {
      type: "feed"
      podcastTitle: string
      episodes: typeof result.episodes
      notice?: string
    } = {
      type: "feed",
      podcastTitle: result.podcastTitle,
      episodes: result.episodes.slice(0, 25),
    }

    if (result.singleEpisode) {
      payload.notice = FEED_FALLBACK_NOTICE
    }

    return Response.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 422 })
  }
}
