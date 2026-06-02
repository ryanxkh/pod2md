"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Library } from "lucide-react"
import type { EpisodeRow } from "@/components/episode-list"
import { collectionSlug } from "@/lib/export"
import { downloadCollectionZip } from "@/lib/episode-export-client"
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify"
import { EmptyState } from "@/components/empty-state"

interface CollectionsViewProps {
  episodes: EpisodeRow[]
  collections: string[]
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

export function CollectionsView({
  episodes,
  collections,
}: CollectionsViewProps) {
  const [exporting, setExporting] = useState<string | null>(null)
  const [indexAsClaudeMd, setIndexAsClaudeMd] = useState(false)

  const collectionStats = useMemo(() => {
    const fromEpisodes = episodes
      .map((ep) => ep.collection)
      .filter((c): c is string => !!c)
    const all = [...new Set([...collections, ...fromEpisodes])].sort()

    return all.map((name) => {
      const inCollection = episodes.filter((ep) => ep.collection === name)
      const completedIds = inCollection
        .filter((ep) => ep.status === "completed")
        .map((ep) => ep.id)
      return {
        name,
        total: inCollection.length,
        completedIds,
      }
    })
  }, [episodes, collections])

  async function handleExport(name: string, completedIds: string[]) {
    if (completedIds.length === 0) {
      notifyInfo("No completed episodes in this collection")
      return
    }
    setExporting(name)
    try {
      const safeName = collectionSlug(name)
      await downloadCollectionZip(
        completedIds,
        name,
        `${safeName}.zip`,
        indexAsClaudeMd,
      )
      notifySuccess(
        `Downloaded knowledge pack (${completedIds.length} episodes)`,
      )
    } catch {
      notifyError("Failed to export collection", {
        label: "Try again",
        onClick: () => void handleExport(name, completedIds),
      })
    } finally {
      setExporting(null)
    }
  }

  if (collectionStats.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="No collections yet"
        description="Add a collection name when transcribing to group episodes into a knowledge pack."
        action={{ label: "Go to Transcribe", href: "/" }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2 text-sm text-fg-secondary">
        <input
          type="checkbox"
          checked={indexAsClaudeMd}
          onChange={(e) => setIndexAsClaudeMd(e.target.checked)}
          className="h-4 w-4 rounded border-border-strong accent-accent"
        />
        Index exports as CLAUDE.md
      </label>
      <ul className="grid gap-4 sm:grid-cols-2">
        {collectionStats.map(({ name, total, completedIds }) => (
          <li
            key={name}
            className="flex flex-col gap-4 rounded-[8px] border border-border bg-surface p-4 transition-colors duration-150 ease-out hover:border-border-strong"
          >
            <Link
              href={`/episodes?collection=${encodeURIComponent(name)}`}
              className={`flex items-start gap-3 ${focusRing} rounded-[8px]`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-elevated text-fg-secondary">
                <Library size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium text-fg">{name}</h2>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {total} episode{total === 1 ? "" : "s"} · {completedIds.length}{" "}
                  completed
                </p>
              </div>
            </Link>
            <button
              type="button"
              disabled={exporting === name || completedIds.length === 0}
              onClick={() => handleExport(name, completedIds)}
              className={`self-start rounded-[8px] border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors duration-150 ease-out hover:border-border-strong hover:bg-elevated hover:text-fg disabled:opacity-50 ${focusRing}`}
            >
              {exporting === name
                ? "Exporting…"
                : "Export knowledge pack .zip"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
