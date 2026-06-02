"use client"

import { useMemo, useState, type ReactNode } from "react"
import type { ResolvedEpisode } from "@/lib/resolvers/types"
import { formatDuration } from "@/lib/format"
import { BATCH_CAP } from "@/lib/batch/resolve"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

const ghostLink =
  `text-xs text-fg-secondary transition-colors duration-150 ease-out hover:text-fg ${focusRing}`

const cardClass =
  "rounded-[8px] border border-border px-4 py-3 transition-colors duration-150 ease-out hover:border-border-strong hover:bg-surface"

const buttonPrimary = `self-start rounded-[8px] bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg transition-colors duration-150 ease-out hover:bg-accent-hover disabled:opacity-50 ${focusRing}`

interface EpisodePickerProps {
  podcastTitle: string
  episodes: ResolvedEpisode[]
  onSelect: (episode: ResolvedEpisode) => void
  onBatchSelect?: (episodes: ResolvedEpisode[]) => void
  onCancel: () => void
  disabled?: boolean
  collection?: string
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
  onBatchSelect,
  onCancel,
  disabled,
  collection,
}: EpisodePickerProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [latestN, setLatestN] = useState(10)
  const [mode, setMode] = useState<"single" | "multi">(
    onBatchSelect ? "multi" : "single",
  )

  const visible = episodes.slice(0, BATCH_CAP)

  const selectedEpisodes = useMemo(
    () => visible.filter((_, i) => selected.has(i)),
    [visible, selected],
  )

  function toggleIndex(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(visible.map((_, i) => i)))
  }

  function selectLatestN() {
    const n = Math.min(latestN, visible.length)
    setSelected(new Set(Array.from({ length: n }, (_, i) => i)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  if (mode === "single" || !onBatchSelect) {
    return (
      <div className="flex flex-col gap-4">
        <PickerHeader
          podcastTitle={podcastTitle}
          onCancel={onCancel}
          disabled={disabled}
          extra={
            onBatchSelect ? (
              <button
                type="button"
                onClick={() => setMode("multi")}
                className={ghostLink}
              >
                Multi-select
              </button>
            ) : null
          }
        />

        <p className="text-xs text-fg-secondary">
          Select an episode to transcribe
        </p>

        <EpisodeRows
          episodes={visible}
          disabled={disabled}
          onRowClick={(ep) => onSelect(ep)}
        />

        {episodes.length > BATCH_CAP && (
          <p className="text-xs text-fg-muted">
            Showing {BATCH_CAP} of {episodes.length} episodes
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PickerHeader
        podcastTitle={podcastTitle}
        onCancel={onCancel}
        disabled={disabled}
        extra={
          <button
            type="button"
            onClick={() => {
              setMode("single")
              clearSelection()
            }}
            className={ghostLink}
          >
            Single-select
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className={ghostLink}
        >
          Select all
        </button>
        <span className="text-fg-muted">·</span>
        <label className="flex items-center gap-1 text-fg-secondary">
          Latest
          <input
            type="number"
            min={1}
            max={BATCH_CAP}
            value={latestN}
            onChange={(e) => setLatestN(Number(e.target.value) || 10)}
            className={`w-12 rounded-[8px] border border-border bg-surface px-1 py-0.5 text-fg ${focusRing}`}
          />
        </label>
        <button
          type="button"
          onClick={selectLatestN}
          disabled={disabled}
          className={ghostLink}
        >
          Apply
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className={ghostLink}
          >
            Clear ({selected.size})
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((ep, i) => (
          <label
            key={`${ep.audioUrl}-${i}`}
            className={`flex cursor-pointer items-start gap-3 ${cardClass}`}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggleIndex(i)}
              disabled={disabled}
              className={`mt-1 h-4 w-4 shrink-0 accent-accent ${focusRing}`}
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-fg">
                {ep.title}
              </span>
              <span className="flex gap-3 text-xs text-fg-secondary">
                {ep.publishedAt && <span>{formatDate(ep.publishedAt)}</span>}
                {ep.durationSecs != null && (
                  <span>{formatDuration(ep.durationSecs)}</span>
                )}
              </span>
            </span>
          </label>
        ))}
      </div>

      {collection && (
        <p className="text-xs text-fg-secondary">
          Collection: <span className="font-medium text-fg">{collection}</span>
        </p>
      )}

      <button
        type="button"
        disabled={disabled || selectedEpisodes.length === 0}
        onClick={() => onBatchSelect(selectedEpisodes)}
        className={buttonPrimary}
      >
        Transcribe {selectedEpisodes.length || ""}
        {selectedEpisodes.length === 1 ? " episode" : " episodes"}
      </button>
    </div>
  )
}

function PickerHeader({
  podcastTitle,
  onCancel,
  disabled,
  extra,
}: {
  podcastTitle: string
  onCancel: () => void
  disabled?: boolean
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-fg">
        {podcastTitle}
      </h3>
      <div className="flex items-center gap-3">
        {extra}
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className={`text-sm text-fg-secondary transition-colors duration-150 ease-out hover:text-fg disabled:opacity-50 ${focusRing}`}
        >
          &larr; Back
        </button>
      </div>
    </div>
  )
}

function EpisodeRows({
  episodes,
  disabled,
  onRowClick,
}: {
  episodes: ResolvedEpisode[]
  disabled?: boolean
  onRowClick: (ep: ResolvedEpisode) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {episodes.map((ep, i) => (
        <button
          key={`${ep.audioUrl}-${i}`}
          type="button"
          onClick={() => onRowClick(ep)}
          disabled={disabled}
          className={`flex flex-col gap-1 text-left disabled:opacity-50 ${cardClass} ${focusRing}`}
        >
          <span className="text-sm font-medium text-fg">
            {ep.title}
          </span>
          <span className="flex gap-3 text-xs text-fg-secondary">
            {ep.publishedAt && <span>{formatDate(ep.publishedAt)}</span>}
            {ep.durationSecs != null && (
              <span>{formatDuration(ep.durationSecs)}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
