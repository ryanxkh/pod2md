import { resolveRss } from "@/lib/resolvers/rss"
import type { ResolverResult } from "@/lib/resolvers/types"

interface ItunesLookupResult {
  feedUrl?: string
}

interface ItunesLookupResponse {
  resultCount: number
  results: ItunesLookupResult[]
}

export async function resolveApple(appleUrl: string): Promise<ResolverResult> {
  const match = appleUrl.match(/\/id(\d+)/)
  if (!match) {
    throw new Error(
      `Invalid Apple Podcasts URL: could not extract podcast ID from "${appleUrl}"`,
    )
  }
  const podcastId = match[1]

  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`,
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iTunes Lookup API failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as ItunesLookupResponse
  const feedUrl = data.results[0]?.feedUrl
  if (!feedUrl) {
    throw new Error(
      `No RSS feed URL found for Apple Podcasts ID ${podcastId}`,
    )
  }

  return resolveRss(feedUrl)
}
