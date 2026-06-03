import type { ResolvedEpisode } from "@/lib/resolvers/types"

export function normaliseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function matchEpisodeByTitle(
  episodes: ResolvedEpisode[],
  title: string,
): ResolvedEpisode | null {
  const target = normaliseTitle(title)
  if (!target) return null

  const idx = episodes.findIndex(
    (ep) =>
      normaliseTitle(ep.title).includes(target) ||
      target.includes(normaliseTitle(ep.title)),
  )
  return idx >= 0 ? episodes[idx] : null
}
