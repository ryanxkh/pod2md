export type UrlType = "rss" | "apple" | "direct"

export function detectUrlType(url: string): UrlType {
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
export { resolveRss } from "@/lib/resolvers/rss"
export { resolveApple } from "@/lib/resolvers/apple"
