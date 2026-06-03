import { matchEpisodeByTitle } from "@/lib/resolvers/match-episode"
import { resolveRss } from "@/lib/resolvers/rss"
import type { ResolverResult } from "@/lib/resolvers/types"

interface ItunesLookupResult {
  feedUrl?: string
  trackName?: string
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

  let episodeId: string | null = null
  try {
    episodeId = new URL(appleUrl).searchParams.get("i")
  } catch {
    episodeId = null
  }
  const singleEpisode = episodeId != null && episodeId !== ""

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

  const result = await resolveRss(feedUrl)

  if (!singleEpisode || !episodeId) {
    return result
  }

  let episodeTitle: string | null = null
  const epRes = await fetch(
    `https://itunes.apple.com/lookup?id=${episodeId}&entity=podcastEpisode`,
  )
  if (epRes.ok) {
    const epData = (await epRes.json()) as ItunesLookupResponse
    episodeTitle = epData.results[0]?.trackName ?? null
  }

  const matchedEpisode = episodeTitle
    ? (matchEpisodeByTitle(result.episodes, episodeTitle) ?? undefined)
    : undefined

  if (matchedEpisode) {
    const idx = result.episodes.findIndex(
      (ep) => ep.audioUrl === matchedEpisode.audioUrl,
    )
    if (idx > 0) {
      const [matched] = result.episodes.splice(idx, 1)
      result.episodes.unshift(matched)
    }
  }

  return {
    ...result,
    singleEpisode: true,
    matchedEpisode,
  }
}
