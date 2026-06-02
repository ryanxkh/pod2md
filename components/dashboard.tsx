"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SubmitForm } from "./submit-form"
import { EpisodeListView, type EpisodeRow } from "./episode-list"
import { collectionSlug } from "@/lib/export"
import {
  downloadCollectionZip,
  downloadZip,
  fetchEpisodeExport,
} from "@/lib/episode-export-client"
import { showToast } from "@/components/toast"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

function isFailed(status: string) {
  return status === "failed" || status === "cancelled"
}

function isRunning(status: string) {
  return status !== "completed" && !isFailed(status)
}

interface DashboardProps {
  initialEpisodes: EpisodeRow[]
  collections: string[]
  showSubmit?: boolean
  collectionFilter?: string | null
  onCollectionFilterChange?: (filter: string | null) => void
}

export function Dashboard({
  initialEpisodes,
  collections,
  showSubmit = true,
  collectionFilter: collectionFilterProp,
  onCollectionFilterChange,
}: DashboardProps) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initialEpisodes)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [indexAsClaudeMd, setIndexAsClaudeMd] = useState(false)
  const [internalCollectionFilter, setInternalCollectionFilter] = useState<
    string | null
  >(null)
  const collectionFilter =
    collectionFilterProp !== undefined
      ? collectionFilterProp
      : internalCollectionFilter
  const setCollectionFilter =
    onCollectionFilterChange ?? setInternalCollectionFilter
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const pollRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  )

  const filteredEpisodes = useMemo(() => {
    let list = episodes
    if (collectionFilter) {
      list = list.filter((ep) => ep.collection === collectionFilter)
    }
    if (activeBatchId) {
      list = list.filter((ep) => ep.batchId === activeBatchId)
    }
    return list
  }, [episodes, collectionFilter, activeBatchId])

  const batchIds = useMemo(() => {
    const ids = new Set<string>()
    for (const ep of episodes) {
      if (ep.batchId) ids.add(ep.batchId)
    }
    return [...ids]
  }, [episodes])

  const batchProgress = useMemo(() => {
    if (!activeBatchId) return null
    const batchEps = episodes.filter((ep) => ep.batchId === activeBatchId)
    if (batchEps.length === 0) return null
    const done = batchEps.filter((ep) => ep.status === "completed").length
    const running = batchEps.filter((ep) => isRunning(ep.status)).length
    const failed = batchEps.filter((ep) => isFailed(ep.status)).length
    return { done, running, failed, total: batchEps.length }
  }, [episodes, activeBatchId])

  const failedInView = filteredEpisodes.filter((ep) => isFailed(ep.status))

  const completedEpisodes = filteredEpisodes.filter(
    (ep) => ep.status === "completed",
  )
  const hasCompleted = completedEpisodes.length > 0
  const allCompletedSelected =
    hasCompleted &&
    completedEpisodes.every((ep) => selectedIds.has(ep.id))

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allCompletedSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(completedEpisodes.map((ep) => ep.id)))
    }
  }, [allCompletedSelected, completedEpisodes])

  const handleBulkCopy = useCallback(async () => {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(fetchEpisodeExport),
      )
      const combined = results.map((r) => r.markdown).join("\n\n---\n\n")
      await navigator.clipboard.writeText(combined)
      showToast(`Copied ${results.length} transcript${results.length > 1 ? "s" : ""}`)
    } catch {
      showToast("Failed to copy transcripts")
    } finally {
      setExporting(false)
    }
  }, [selectedIds])

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      await downloadZip(Array.from(selectedIds), "transcripts.zip")
      showToast(`Downloading ${selectedIds.size} transcript${selectedIds.size > 1 ? "s" : ""}`)
    } catch {
      showToast("Failed to download transcripts")
    } finally {
      setExporting(false)
    }
  }, [selectedIds])

  const handleExportCollection = useCallback(async () => {
    if (!collectionFilter) return
    const ids = episodes
      .filter(
        (ep) => ep.collection === collectionFilter && ep.status === "completed",
      )
      .map((ep) => ep.id)
    if (ids.length === 0) {
      showToast("No completed episodes in this collection")
      return
    }
    setExporting(true)
    try {
      const safeName = collectionSlug(collectionFilter)
      await downloadCollectionZip(
        ids,
        collectionFilter,
        `${safeName}.zip`,
        indexAsClaudeMd,
      )
      showToast(`Downloaded knowledge pack (${ids.length} episodes)`)
    } catch {
      showToast("Failed to export collection")
    } finally {
      setExporting(false)
    }
  }, [collectionFilter, episodes, indexAsClaudeMd])

  const stopPolling = useCallback((id: string) => {
    const timer = pollRef.current.get(id)
    if (timer) {
      clearInterval(timer)
      pollRef.current.delete(id)
    }
  }, [])

  const startPolling = useCallback(
    (id: string) => {
      if (pollRef.current.has(id)) return
      const timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/episodes/${id}`)
          if (!res.ok) return
          const data = await res.json()
          const status: string = data.job?.status ?? "completed"
          setEpisodes((prev) =>
            prev.map((ep) => (ep.id === id ? { ...ep, status } : ep)),
          )
          if (status === "completed" || status === "failed") {
            stopPolling(id)
          }
        } catch {
          /* ignore transient fetch errors */
        }
      }, 5000)
      pollRef.current.set(id, timer)
    },
    [stopPolling],
  )

  const handleRetry = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/episodes/${id}/retry`, { method: "POST" })
        if (!res.ok) {
          const data = await res.json()
          showToast(data.error ?? "Retry failed")
          return
        }
        setEpisodes((prev) =>
          prev.map((ep) => (ep.id === id ? { ...ep, status: "queued" } : ep)),
        )
        startPolling(id)
        showToast("Retrying transcription")
      } catch {
        showToast("Retry failed")
      }
    },
    [startPolling],
  )

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this episode? This cannot be undone.")) return
    const prev = episodes
    setEpisodes((curr) => curr.filter((ep) => ep.id !== id))
    setSelectedIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    try {
      const res = await fetch(`/api/episodes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setEpisodes(prev)
        showToast("Delete failed")
      }
    } catch {
      setEpisodes(prev)
      showToast("Delete failed")
    }
  }, [episodes])

  const handleRetryAllFailed = useCallback(async () => {
    const failed = failedInView.map((ep) => ep.id)
    if (failed.length === 0) return
    for (const id of failed) {
      await handleRetry(id)
    }
  }, [failedInView, handleRetry])

  const handleClearFailed = useCallback(async () => {
    const failed = failedInView.map((ep) => ep.id)
    if (failed.length === 0) return
    if (!confirm(`Delete ${failed.length} failed episode(s)?`)) return
    for (const id of failed) {
      await handleDelete(id)
    }
  }, [failedInView, handleDelete])

  useEffect(() => {
    for (const ep of episodes) {
      if (isRunning(ep.status)) {
        startPolling(ep.id)
      }
    }
    const polls = pollRef.current
    return () => {
      for (const id of polls.keys()) stopPolling(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmitted = useCallback(
    (episodeId: string, title: string, collection?: string | null) => {
      const newEp: EpisodeRow = {
        id: episodeId,
        title,
        createdAt: new Date().toISOString(),
        status: "queued",
        collection: collection ?? null,
        batchId: null,
      }
      setEpisodes((prev) => [newEp, ...prev])
      startPolling(episodeId)
    },
    [startPolling],
  )

  const handleBatchSubmitted = useCallback(
    ({
      batchId,
      episodeIds,
      titles,
      collection,
    }: {
      batchId: string
      episodeIds: string[]
      titles: string[]
      collection?: string | null
    }) => {
      setActiveBatchId(batchId)
      const now = new Date().toISOString()
      const newEps: EpisodeRow[] = episodeIds.map((id, i) => ({
        id,
        title: titles[i] ?? "Episode",
        createdAt: now,
        status: "queued",
        collection: collection ?? null,
        batchId,
      }))
      setEpisodes((prev) => [...newEps, ...prev])
      for (const id of episodeIds) {
        startPolling(id)
      }
      showToast(`Queued ${episodeIds.length} episode(s)`)
    },
    [startPolling],
  )

  const allCollections = useMemo(() => {
    const fromEpisodes = episodes
      .map((ep) => ep.collection)
      .filter((c): c is string => !!c)
    return [...new Set([...collections, ...fromEpisodes])].sort()
  }, [collections, episodes])

  const filterPillActive =
    "bg-accent text-accent-fg"
  const filterPillInactive =
    "bg-elevated text-fg-secondary hover:bg-surface hover:text-fg"

  return (
    <div className="flex flex-col gap-10">
      {showSubmit && (
        <SubmitForm
          onSubmitted={handleSubmitted}
          onBatchSubmitted={handleBatchSubmitted}
        />
      )}

      {(allCollections.length > 0 || batchIds.length > 0) && (
        <div className="flex flex-col gap-2">
          {allCollections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-muted">Collection</span>
              <button
                type="button"
                onClick={() => setCollectionFilter(null)}
                className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors duration-150 ease-out ${focusRing} ${
                  collectionFilter === null
                    ? filterPillActive
                    : filterPillInactive
                }`}
              >
                All
              </button>
              {allCollections.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCollectionFilter(c)}
                  className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors duration-150 ease-out ${focusRing} ${
                    collectionFilter === c
                      ? filterPillActive
                      : filterPillInactive
                  }`}
                >
                  {c}
                </button>
              ))}
              {collectionFilter && (
                <div className="ml-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={indexAsClaudeMd}
                      onChange={(e) => setIndexAsClaudeMd(e.target.checked)}
                      className="rounded border-border-strong accent-accent"
                    />
                    Index as CLAUDE.md
                  </label>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportCollection}
                    className={`text-xs text-fg-secondary transition-colors duration-150 ease-out hover:text-fg ${focusRing}`}
                  >
                    Export knowledge pack .zip
                  </button>
                </div>
              )}
            </div>
          )}
          {batchIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-muted">Batch</span>
              <button
                type="button"
                onClick={() => setActiveBatchId(null)}
                className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors duration-150 ease-out ${focusRing} ${
                  activeBatchId === null
                    ? filterPillActive
                    : filterPillInactive
                }`}
              >
                All
              </button>
              {batchIds.slice(0, 5).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveBatchId(id)}
                  className={`rounded-[4px] px-2.5 py-1 font-mono text-xs transition-colors duration-150 ease-out ${focusRing} ${
                    activeBatchId === id
                      ? filterPillActive
                      : filterPillInactive
                  }`}
                >
                  {id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
          {batchProgress && (
            <p className="text-sm text-fg-secondary">
              Batch progress: {batchProgress.done} done · {batchProgress.running}{" "}
              running · {batchProgress.failed} failed
            </p>
          )}
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-fg-secondary">
            Recent episodes
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {failedInView.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleRetryAllFailed}
                  className={`text-xs text-fg-secondary transition-colors duration-150 ease-out hover:text-fg ${focusRing}`}
                >
                  Retry all failed
                </button>
                <button
                  type="button"
                  onClick={handleClearFailed}
                  className={`text-xs text-status-fail transition-colors duration-150 ease-out hover:opacity-80 ${focusRing}`}
                >
                  Clear failed
                </button>
              </>
            )}
            {hasCompleted && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className={`text-xs text-fg-muted transition-colors duration-150 ease-out hover:text-fg-secondary ${focusRing}`}
              >
                {allCompletedSelected ? "Deselect all" : "Select all completed"}
              </button>
            )}
          </div>
        </div>

        <EpisodeListView
          episodes={filteredEpisodes}
          selectedIds={selectedIds}
          onToggle={toggleSelection}
          onRetry={handleRetry}
          onDelete={handleDelete}
        />

        {selectedIds.size > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-[8px] border border-border bg-surface px-4 py-3">
            <span className="mr-auto text-sm text-fg-secondary">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleBulkCopy}
              disabled={exporting}
              className={`rounded-[8px] bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-colors duration-150 ease-out hover:bg-accent-hover disabled:opacity-50 ${focusRing}`}
            >
              {exporting ? "Exporting\u2026" : "Copy all"}
            </button>
            <button
              type="button"
              onClick={handleBulkDownload}
              disabled={exporting}
              className={`rounded-[8px] border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors duration-150 ease-out hover:border-border-strong hover:bg-elevated hover:text-fg disabled:opacity-50 ${focusRing}`}
            >
              {exporting ? "Exporting\u2026" : "Download .zip"}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
