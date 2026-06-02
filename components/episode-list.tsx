import Link from "next/link"
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
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        No episodes yet. Submit a URL above to get started.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
      {episodes.map((ep) => {
        const isCompleted = ep.status === "completed"
        const showCheckbox = selectedIds !== undefined && isCompleted
        const showActions = isFailed(ep.status)

        return (
          <li
            key={ep.id}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {selectedIds !== undefined && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(ep.id)}
                  disabled={!isCompleted}
                  onChange={() => onToggle?.(ep.id)}
                  className={`h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 ${
                    !showCheckbox ? "invisible" : ""
                  }`}
                />
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                {isCompleted ? (
                  <Link
                    href={`/episodes/${ep.id}`}
                    className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {ep.title}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {ep.title}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                  <time>{new Date(ep.createdAt).toLocaleDateString()}</time>
                  {ep.collection && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
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
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.68a.75.75 0 0 1-1.5 0V9.566a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.025-.274Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(ep.id)}
                    title="Delete"
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
                        clipRule="evenodd"
                      />
                    </svg>
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
