"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { usePaletteOpen } from "@/components/palette-context"
import { SubmitForm } from "./submit-form"
import { EpisodeListView, type EpisodeRow } from "./episode-list"
import { collectionSlug } from "@/lib/export"
import {
  downloadCollectionZip,
  downloadZip,
  fetchEpisodeExport,
} from "@/lib/episode-export-client"
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify"
import { BatchProgressBar } from "@/components/batch-progress-bar"

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

const REFRESH_INTERVAL_MS = 5000

export function Dashboard({
  initialEpisodes,
  collections,
  showSubmit = true,
  collectionFilter: collectionFilterProp,
  onCollectionFilterChange,
}: DashboardProps) {
  const router = useRouter()
  const [pendingEpisodes, setPendingEpisodes] = useState<EpisodeRow[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set())
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, string>
  >({})
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
  const [search, setSearch] = useState("")
  const paletteOpen = usePaletteOpen()
  const handleBulkCopyRef = useRef<() => void>(() => {})
  const handleBulkDownloadRef = useRef<() => void>(() => {})
  const handleExportCollectionRef = useRef<() => void>(() => {})
  const handleRetryRef = useRef<(id: string) => void>(() => {})
  const handleDeleteRef = useRef<(id: string) => void>(() => {})

  const episodes = useMemo(() => {
    const serverIds = new Set(initialEpisodes.map((ep) => ep.id))
    const pending = pendingEpisodes.filter((ep) => !serverIds.has(ep.id))
    const merged = [...pending, ...initialEpisodes]
      .filter((ep) => !hiddenIds.has(ep.id))
      .map((ep) => {
        const override = statusOverrides[ep.id]
        return override ? { ...ep, status: override } : ep
      })
    return merged
  }, [initialEpisodes, pendingEpisodes, hiddenIds, statusOverrides])

  const filteredEpisodes = useMemo(() => {
    let list = episodes
    if (collectionFilter) {
      list = list.filter((ep) => ep.collection === collectionFilter)
    }
    if (activeBatchId) {
      list = list.filter((ep) => ep.batchId === activeBatchId)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((ep) => ep.title.toLowerCase().includes(q))
    }
    return list
  }, [episodes, collectionFilter, activeBatchId, search])

  const clearFilters = useCallback(() => {
    setCollectionFilter(null)
    setActiveBatchId(null)
    setSearch("")
  }, [setCollectionFilter])

  const hasRunningJobs = useMemo(
    () => episodes.some((ep) => isRunning(ep.status)),
    [episodes],
  )

  useEffect(() => {
    if (!hasRunningJobs) return
    const timer = setInterval(() => {
      router.refresh()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasRunningJobs, router])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || paletteOpen) return
      if (selectedIds.size === 0) return
      setSelectedIds(new Set())
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [paletteOpen, selectedIds.size])

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
      notifySuccess(
        `Copied ${results.length} transcript${results.length > 1 ? "s" : ""}`,
      )
    } catch {
      notifyError("Failed to copy transcripts", {
        label: "Try again",
        onClick: () => handleBulkCopyRef.current(),
      })
    } finally {
      setExporting(false)
    }
  }, [selectedIds])

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      await downloadZip(Array.from(selectedIds), "transcripts.zip")
      notifySuccess(
        `Downloading ${selectedIds.size} transcript${selectedIds.size > 1 ? "s" : ""}`,
      )
    } catch {
      notifyError("Failed to download transcripts", {
        label: "Try again",
        onClick: () => handleBulkDownloadRef.current(),
      })
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
      notifyInfo("No completed episodes in this collection")
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
      notifySuccess(`Downloaded knowledge pack (${ids.length} episodes)`)
    } catch {
      notifyError("Failed to export collection", {
        label: "Try again",
        onClick: () => handleExportCollectionRef.current(),
      })
    } finally {
      setExporting(false)
    }
  }, [collectionFilter, episodes, indexAsClaudeMd])

  const handleRetry = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/episodes/${id}/retry`, { method: "POST" })
        if (!res.ok) {
          const data = await res.json()
          notifyError(data.error ?? "Retry failed", {
            label: "Retry",
            onClick: () => handleRetryRef.current(id),
          })
          return
        }
        setStatusOverrides((prev) => ({ ...prev, [id]: "queued" }))
        router.refresh()
        notifySuccess("Retrying transcription")
      } catch {
        notifyError("Retry failed", {
          label: "Retry",
          onClick: () => handleRetryRef.current(id),
        })
      }
    },
    [router],
  )

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this episode? This cannot be undone.")) return
    setHiddenIds((prev) => new Set(prev).add(id))
    setSelectedIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    try {
      const res = await fetch(`/api/episodes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setHiddenIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        notifyError("Delete failed", {
          label: "Retry",
          onClick: () => handleDeleteRef.current(id),
        })
      } else {
        router.refresh()
      }
    } catch {
      setHiddenIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      notifyError("Delete failed", {
        label: "Retry",
        onClick: () => handleDeleteRef.current(id),
      })
    }
  }, [router])

  useEffect(() => {
    handleBulkCopyRef.current = () => {
      void handleBulkCopy()
    }
    handleBulkDownloadRef.current = () => {
      void handleBulkDownload()
    }
    handleExportCollectionRef.current = () => {
      void handleExportCollection()
    }
    handleRetryRef.current = (id) => {
      void handleRetry(id)
    }
    handleDeleteRef.current = (id) => {
      void handleDelete(id)
    }
  }, [
    handleBulkCopy,
    handleBulkDownload,
    handleExportCollection,
    handleRetry,
    handleDelete,
  ])

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
      setPendingEpisodes((prev) => [newEp, ...prev])
      router.refresh()
    },
    [router],
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
      setPendingEpisodes((prev) => [...newEps, ...prev])
      router.refresh()
      notifySuccess(`Queued ${episodeIds.length} episode(s)`)
    },
    [router],
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
            <BatchProgressBar
              done={batchProgress.done}
              running={batchProgress.running}
              failed={batchProgress.failed}
              total={batchProgress.total}
            />
          )}
        </div>
      )}

      <section className={selectedIds.size > 0 ? "pb-24" : undefined}>
        {!showSubmit && (
          <div className="relative mb-4 max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search episodes…"
              aria-label="Search episodes by title"
              className={`w-full rounded-[8px] border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted transition-colors duration-150 ease-out hover:border-border-strong focus:border-border-strong ${focusRing}`}
            />
          </div>
        )}

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
          isFilteredEmpty={
            filteredEpisodes.length === 0 &&
            episodes.length > 0 &&
            (collectionFilter != null ||
              activeBatchId != null ||
              search.trim().length > 0)
          }
          onClearFilter={clearFilters}
        />
      </section>

      {selectedIds.size > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 md:pl-[var(--sidebar-margin,0px)]"
          role="region"
          aria-label="Bulk actions"
        >
          <div className="pointer-events-auto flex w-full max-w-[880px] items-center gap-2 rounded-[8px] border border-border bg-elevated px-4 py-3">
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
              className={`rounded-[8px] border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors duration-150 ease-out hover:border-border-strong hover:bg-surface hover:text-fg disabled:opacity-50 ${focusRing}`}
            >
              {exporting ? "Exporting\u2026" : "Download .zip"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className={`rounded-[8px] p-1.5 text-fg-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-fg ${focusRing}`}
              aria-label="Deselect all"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
