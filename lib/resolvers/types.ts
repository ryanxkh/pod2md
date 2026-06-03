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
  /** Pasted URL targets one episode (Spotify episode link, Apple `?i=`). */
  singleEpisode?: boolean
  /** Episode resolved from the feed when `singleEpisode` is true. */
  matchedEpisode?: ResolvedEpisode
}
