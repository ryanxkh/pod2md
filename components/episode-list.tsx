import Link from "next/link"
import { StatusBadge } from "./status-badge"

export interface EpisodeRow {
  id: string
  title: string
  createdAt: string
  status: string
}

export function EpisodeListView({ episodes }: { episodes: EpisodeRow[] }) {
  if (episodes.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        No episodes yet. Submit a URL above to get started.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
      {episodes.map((ep) => (
        <li
          key={ep.id}
          className="flex items-center justify-between gap-4 py-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            {ep.status === "completed" ? (
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
            <time className="text-xs text-zinc-400 dark:text-zinc-500">
              {new Date(ep.createdAt).toLocaleDateString()}
            </time>
          </div>
          <StatusBadge status={ep.status} />
        </li>
      ))}
    </ul>
  )
}
