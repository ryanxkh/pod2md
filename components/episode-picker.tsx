"use client"

import type { ResolvedEpisode } from "@/lib/resolvers/types"
import { formatDuration } from "@/lib/format"

const MAX_EPISODES = 25

interface EpisodePickerProps {
  podcastTitle: string
  episodes: ResolvedEpisode[]
  onSelect: (episode: ResolvedEpisode) => void
  onCancel: () => void
  disabled?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function EpisodePicker({
  podcastTitle,
  episodes,
  onSelect,
  onCancel,
  disabled,
}: EpisodePickerProps) {
  const visible = episodes.slice(0, MAX_EPISODES)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {podcastTitle}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          &larr; Back
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Select an episode to transcribe
      </p>

      <div className="flex flex-col gap-2">
        {visible.map((ep, i) => (
          <button
            key={`${ep.audioUrl}-${i}`}
            type="button"
            onClick={() => onSelect(ep)}
            disabled={disabled}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 px-4 py-3 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
          >
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {ep.title}
            </span>
            <span className="flex gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              {ep.publishedAt && <span>{formatDate(ep.publishedAt)}</span>}
              {ep.durationSecs != null && (
                <span>{formatDuration(ep.durationSecs)}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {episodes.length > MAX_EPISODES && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Showing {MAX_EPISODES} of {episodes.length} episodes
        </p>
      )}
    </div>
  )
}
