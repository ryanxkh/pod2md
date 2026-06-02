import Link from "next/link"
import { AudioLines, Check, Clock, FilterX, Loader2, RotateCw, Trash2 } from "lucide-react"
import { StatusBadge } from "./status-badge"
import { EmptyState } from "./empty-state"

export interface EpisodeRow {
  id: string
  title: string
  createdAt: string
  status: string
  collection?: string | null
  batchId?: string | null
}

interface EpisodeListViewProps {
  episodes: EpisodeRow[]
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
  onRetry?: (id: string) => void
  onDelete?: (id: string) => void
  isFilteredEmpty?: boolean
  onClearFilter?: () => void
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

function isFailed(status: string) {
  return status === "failed" || status === "cancelled"
}

function isRunning(status: string) {
  return (
    status !== "queued" && status !== "completed" && !isFailed(status)
  )
}

function RowStatusIndicator({ status }: { status: string }) {
  if (status === "queued") {
    return (
      <Clock
        size={16}
        className="shrink-0 text-status-queued transition-opacity duration-150 ease-out"
        aria-hidden
      />
    )
  }
  if (isRunning(status)) {
    return (
      <Loader2
        size={16}
        className="shrink-0 animate-spin text-accent motion-reduce:animate-none"
        aria-hidden
      />
    )
  }
  if (status === "completed") {
    return (
      <Check
        size={16}
        className="shrink-0 text-status-done opacity-70 transition-opacity duration-150 ease-out"
        aria-hidden
      />
    )
  }
  return null
}

export function EpisodeListView({
  episodes,
  selectedIds,
  onToggle,
  onRetry,
  onDelete,
  isFilteredEmpty = false,
  onClearFilter,
}: EpisodeListViewProps) {
  if (episodes.length === 0) {
    if (isFilteredEmpty) {
      return (
        <EmptyState
          icon={FilterX}
          title="Nothing here"
          description="No episodes match this filter."
          action={{ label: "Clear filter", onClick: () => onClearFilter?.() }}
        />
      )
    }
    return (
      <EmptyState
        icon={AudioLines}
        title="No transcripts yet"
        description="Paste a podcast or video URL to get your first transcript."
        action={{ label: "Go to Transcribe", href: "/" }}
      />
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {episodes.map((ep) => {
        const isCompleted = ep.status === "completed"
        const showCheckbox = selectedIds !== undefined && isCompleted
        const showActions = isFailed(ep.status)

        return (
          <li
            key={ep.id}
            className="flex items-center justify-between gap-4 rounded-[8px] px-2 py-3 transition-colors duration-150 ease-out hover:bg-surface"
          >
            <div className="flex min-w-0 items-center gap-3">
              {selectedIds !== undefined && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(ep.id)}
                  disabled={!isCompleted}
                  onChange={() => onToggle?.(ep.id)}
                  className={`h-4 w-4 shrink-0 rounded border-border-strong accent-accent ${focusRing} ${
                    !showCheckbox ? "invisible" : ""
                  }`}
                />
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                {isCompleted ? (
                  <Link
                    href={`/episodes/${ep.id}`}
                    className={`truncate text-sm font-medium text-fg hover:underline ${focusRing}`}
                  >
                    {ep.title}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium text-fg">
                    {ep.title}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <time>{new Date(ep.createdAt).toLocaleDateString()}</time>
                  {ep.collection && (
                    <span className="rounded-[4px] bg-elevated px-1.5 py-0.5 text-fg-secondary">
                      {ep.collection}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showActions && (
                <>
                  <button
                    type="button"
                    onClick={() => onRetry?.(ep.id)}
                    title="Retry"
                    className={`rounded-[8px] p-1 text-fg-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-fg ${focusRing}`}
                  >
                    <RotateCw size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(ep.id)}
                    title="Delete"
                    className={`rounded-[8px] p-1 text-fg-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-status-fail ${focusRing}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </>
              )}
              <RowStatusIndicator status={ep.status} />
              <StatusBadge status={ep.status} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
