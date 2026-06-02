import type { BatchResolvedItem } from "@/lib/batch/types"
import type { ResolvedEpisode } from "@/lib/resolvers/types"

export function episodesToBatchItems(
  episodes: ResolvedEpisode[],
  inputUrl: string,
  show?: string | null,
): BatchResolvedItem[] {
  return episodes.map((ep) => ({
    title: ep.title,
    audio_url: ep.audioUrl,
    source_url: ep.audioUrl,
    source_type: "direct" as const,
    published_at: ep.publishedAt,
    description: ep.description,
    duration_secs: ep.durationSecs,
    disposition: "new" as const,
    input_url: inputUrl,
    show: show ?? null,
  }))
}
