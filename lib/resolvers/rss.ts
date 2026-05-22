import Parser from "rss-parser"

import type { ResolvedEpisode, ResolverResult } from "@/lib/resolvers/types"

type ItunesItem = {
  itunes?: { duration?: string; summary?: string }
}

const parser = new Parser<Record<string, unknown>, ItunesItem>({
  customFields: {
    item: [["itunes:duration", "itunes.duration"]],
  },
})

function parseDuration(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Raw seconds (e.g. "3600")
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10)

  // MM:SS or HH:MM:SS
  const parts = trimmed.split(":").map(Number)
  if (parts.some(isNaN)) return null

  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]

  return null
}

export async function resolveRss(feedUrl: string): Promise<ResolverResult> {
  let feed: Awaited<ReturnType<typeof parser.parseURL>>
  try {
    feed = await parser.parseURL(feedUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch or parse RSS feed: ${msg}`)
  }

  const episodes: ResolvedEpisode[] = feed.items
    .filter((item) => item.enclosure?.url)
    .map((item) => {
      const itunesDuration = item.itunes?.duration
      return {
        title: item.title ?? "Untitled",
        audioUrl: item.enclosure!.url,
        publishedAt: item.isoDate ?? item.pubDate ?? null,
        description: item.contentSnippet ?? item.itunes?.summary ?? null,
        durationSecs: itunesDuration ? parseDuration(itunesDuration) : null,
      }
    })
    .sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0
      if (!a.publishedAt) return 1
      if (!b.publishedAt) return -1
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

  return {
    podcastTitle: feed.title ?? "Unknown Podcast",
    episodes,
  }
}
