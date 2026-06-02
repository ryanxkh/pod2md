import Link from "next/link"
import { RotateCw, Trash2 } from "lucide-react"
import { StatusBadge } from "./status-badge"

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
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

function isFailed(status: string) {
  return status === "failed" || status === "cancelled"
}

export function EpisodeListView({
  episodes,
  selectedIds,
  onToggle,
  onRetry,
  onDelete,
}: EpisodeListViewProps) {
  if (episodes.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        No episodes yet. Submit a URL on Transcribe to get started.
      </p>
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
              <StatusBadge status={ep.status} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
