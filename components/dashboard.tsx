"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import { SubmitForm } from "./submit-form"
import { EpisodeListView, type EpisodeRow } from "./episode-list"
import {
  generateExportMarkdown,
  episodeFilename,
  generateCollectionIndex,
  collectionSlug,
  type ExportEpisode,
} from "@/lib/export"
import type { EpisodeEnrichment } from "@/lib/db/schema"
import { showToast } from "@/components/toast"

interface EpisodeApiResponse {
  episode: {
    id: string
    title: string
    source_url: string
    published_at: string | null
    duration_secs: number | null
    collection: string | null
    show: string | null
    language: string | null
    enrichment: EpisodeEnrichment | null
    created_at: string
  }
  speakers: Array<{ id: string; name: string }>
  segments: Array<{
    start_ms: number
    speaker_name: string
    text: string
  }>
}

function buildExportEpisode(data: EpisodeApiResponse): ExportEpisode {
  return {
    id: data.episode.id,
    title: data.episode.title,
    sourceUrl: data.episode.source_url,
    publishedAt: data.episode.published_at,
    createdAt: data.episode.created_at,
    durationSecs: data.episode.duration_secs,
    speakers: data.speakers.map((s) => s.name),
    collection: data.episode.collection,
    transcribedAt: data.episode.created_at,
    show: data.episode.show,
    language: data.episode.language,
    enrichment: data.episode.enrichment,
  }
}

async function fetchEpisodeExport(id: string): Promise<{
  markdown: string
  episode: ExportEpisode
}> {
  const res = await fetch(`/api/episodes/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch episode ${id}`)
  const data: EpisodeApiResponse = await res.json()
  const episode = buildExportEpisode(data)
  const segments = data.segments.map((seg) => ({
    startMs: seg.start_ms,
    speakerName: seg.speaker_name,
    text: seg.text,
  }))
  const markdown = generateExportMarkdown(episode, segments)
  return { markdown, episode }
}

function isFailed(status: string) {
  return status === "failed" || status === "cancelled"
}

function isRunning(status: string) {
  return status !== "completed" && !isFailed(status)
}

interface DashboardProps {
  initialEpisodes: EpisodeRow[]
  collections: string[]
}

export function Dashboard({ initialEpisodes, collections }: DashboardProps) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initialEpisodes)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [indexAsClaudeMd, setIndexAsClaudeMd] = useState(false)
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null)
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

  const downloadZip = useCallback(
    async (ids: string[], zipName: string) => {
      const results = await Promise.all(ids.map(fetchEpisodeExport))
      const zip = new JSZip()
      const usedNames = new Set<string>()
      for (const r of results) {
        const name = episodeFilename(r.episode, usedNames)
        zip.file(name, r.markdown)
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = zipName
      a.click()
      URL.revokeObjectURL(url)
    },
    [],
  )

  const downloadCollectionZip = useCallback(
    async (
      ids: string[],
      collectionName: string,
      zipName: string,
      useClaudeIndexName: boolean,
    ) => {
      const results = await Promise.all(ids.map(fetchEpisodeExport))
      const zip = new JSZip()
      const folderName = collectionSlug(collectionName)
      const folder = zip.folder(folderName)
      if (!folder) throw new Error("Failed to create zip folder")

      const usedNames = new Set<string>()
      const indexEpisodes = results.map((r) => {
        const filename = episodeFilename(r.episode, usedNames)
        folder.file(filename, r.markdown)
        return {
          filename,
          title: r.episode.title,
          publishedAt: r.episode.publishedAt,
          sourceUrl: r.episode.sourceUrl,
          enrichment: r.episode.enrichment,
        }
      })

      const indexMd = generateCollectionIndex(collectionName, indexEpisodes)
      folder.file(useClaudeIndexName ? "CLAUDE.md" : "INDEX.md", indexMd)

      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = zipName
      a.click()
      URL.revokeObjectURL(url)
    },
    [],
  )

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
  }, [selectedIds, downloadZip])

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
  }, [collectionFilter, episodes, downloadCollectionZip, indexAsClaudeMd])

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

  return (
    <div className="flex flex-col gap-10">
      <SubmitForm
        onSubmitted={handleSubmitted}
        onBatchSubmitted={handleBatchSubmitted}
      />

      {(allCollections.length > 0 || batchIds.length > 0) && (
        <div className="flex flex-col gap-2">
          {allCollections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Collection</span>
              <button
                type="button"
                onClick={() => setCollectionFilter(null)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  collectionFilter === null
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                All
              </button>
              {allCollections.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCollectionFilter(c)}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    collectionFilter === c
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {c}
                </button>
              ))}
              {collectionFilter && (
                <div className="ml-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <input
                      type="checkbox"
                      checked={indexAsClaudeMd}
                      onChange={(e) => setIndexAsClaudeMd(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    Index as CLAUDE.md
                  </label>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportCollection}
                    className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Export knowledge pack .zip
                  </button>
                </div>
              )}
            </div>
          )}
          {batchIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Batch</span>
              <button
                type="button"
                onClick={() => setActiveBatchId(null)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  activeBatchId === null
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                All
              </button>
              {batchIds.slice(0, 5).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveBatchId(id)}
                  className={`rounded-full px-2.5 py-1 font-mono text-xs ${
                    activeBatchId === id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
          {batchProgress && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Batch progress: {batchProgress.done} done · {batchProgress.running}{" "}
              running · {batchProgress.failed} failed
            </p>
          )}
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recent episodes
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {failedInView.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleRetryAllFailed}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Retry all failed
                </button>
                <button
                  type="button"
                  onClick={handleClearFailed}
                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Clear failed
                </button>
              </>
            )}
            {hasCompleted && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
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
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <span className="mr-auto text-sm text-zinc-600 dark:text-zinc-400">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleBulkCopy}
              disabled={exporting}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {exporting ? "Exporting\u2026" : "Copy all"}
            </button>
            <button
              type="button"
              onClick={handleBulkDownload}
              disabled={exporting}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {exporting ? "Exporting\u2026" : "Download .zip"}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
