export interface ResolvedEpisode {
  title: string
  audioUrl: string
  publishedAt: string | null
  description: string | null
  durationSecs: number | null
}

export interface ResolverResult {
  podcastTitle: string
  episodes: ResolvedEpisode[]
}
