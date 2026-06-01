export type UrlType = "rss" | "apple" | "spotify" | "direct" | "youtube"

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, "")
    if (host === "youtu.be") return true
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    )
  } catch {
    return false
  }
}

export function detectUrlType(url: string): UrlType {
  if (isYouTubeUrl(url)) return "youtube"
  if (url.includes("open.spotify.com")) return "spotify"
  if (url.includes("podcasts.apple.com")) return "apple"

  if (
    url.endsWith(".rss") ||
    url.endsWith(".xml") ||
    url.endsWith(".atom") ||
    url.includes("/feed") ||
    url.includes("/rss")
  ) {
    return "rss"
  }

  return "direct"
}

export type { ResolvedEpisode, ResolverResult } from "@/lib/resolvers/types"
export type { YouTubeResolveResult } from "@/lib/resolvers/youtube"
export { resolveRss } from "@/lib/resolvers/rss"
export { resolveApple } from "@/lib/resolvers/apple"
export { resolveSpotify } from "@/lib/resolvers/spotify"
export { resolveYouTube } from "@/lib/resolvers/youtube"
