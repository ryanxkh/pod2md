import { resolveRss } from "@/lib/resolvers/rss"
import type { ResolverResult } from "@/lib/resolvers/types"

interface SpotifyOembedResponse {
  title?: string
  html?: string
}

interface ItunesSearchResult {
  collectionName?: string
  feedUrl?: string
}

interface ItunesSearchResponse {
  resultCount: number
  results: ItunesSearchResult[]
}

function extractShowName(oembed: SpotifyOembedResponse): string | null {
  const iframeTitleMatch = oembed.html?.match(/title="([^"]+)"/)
  if (iframeTitleMatch) return iframeTitleMatch[1]

  // oembed.title is the episode title, not the show name — don't use it here
  return null
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function bestMatch(
  results: ItunesSearchResult[],
  showName: string,
): ItunesSearchResult | null {
  const target = normalise(showName)

  // Exact normalised match first
  const exact = results.find(
    (r) => r.feedUrl && r.collectionName && normalise(r.collectionName) === target,
  )
  if (exact) return exact

  // Substring inclusion
  const partial = results.find(
    (r) =>
      r.feedUrl &&
      r.collectionName &&
      (normalise(r.collectionName).includes(target) ||
        target.includes(normalise(r.collectionName))),
  )
  if (partial) return partial

  // Fall back to first result with a feed URL
  return results.find((r) => r.feedUrl) ?? null
}

export async function resolveSpotify(
  spotifyUrl: string,
): Promise<ResolverResult> {
  const episodeMatch = spotifyUrl.match(
    /open\.spotify\.com\/episode\/([A-Za-z0-9]+)/,
  )
  if (!episodeMatch) {
    throw new Error(
      `Invalid Spotify URL: expected an episode link (open.spotify.com/episode/...)`,
    )
  }

  // Step 1: Fetch episode metadata via Spotify oEmbed
  const oembedRes = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
  )
  if (!oembedRes.ok) {
    const text = await oembedRes.text()
    throw new Error(
      `Could not fetch episode metadata from Spotify (${oembedRes.status}): ${text}`,
    )
  }
  const oembed = (await oembedRes.json()) as SpotifyOembedResponse

  const showName = extractShowName(oembed)
  if (!showName) {
    throw new Error(
      "Could not determine podcast name from Spotify episode metadata",
    )
  }

  // Step 2: Search iTunes for the podcast RSS feed
  const itunesRes = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(showName)}&entity=podcast&attribute=titleTerm&limit=5`,
  )
  if (!itunesRes.ok) {
    const text = await itunesRes.text()
    throw new Error(`iTunes Search API failed (${itunesRes.status}): ${text}`)
  }
  const itunesData = (await itunesRes.json()) as ItunesSearchResponse

  const match = bestMatch(itunesData.results, showName)
  if (!match?.feedUrl) {
    throw new Error(
      "Could not find RSS feed for this podcast. It may be a Spotify exclusive.",
    )
  }

  // Step 3: Delegate to RSS resolver
  const result = await resolveRss(match.feedUrl)

  // Step 4: Boost matching episode to the top if we can identify it
  if (oembed.title) {
    const episodeTitle = normalise(oembed.title)
    const idx = result.episodes.findIndex((ep) =>
      normalise(ep.title).includes(episodeTitle) ||
      episodeTitle.includes(normalise(ep.title)),
    )
    if (idx > 0) {
      const [matched] = result.episodes.splice(idx, 1)
      result.episodes.unshift(matched)
    }
  }

  return result
}
