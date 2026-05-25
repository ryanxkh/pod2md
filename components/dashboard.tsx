"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import JSZip from "jszip"
import { SubmitForm } from "./submit-form"
import { EpisodeListView, type EpisodeRow } from "./episode-list"
import { generateExportMarkdown, episodeFilename } from "@/lib/export"
import { showToast } from "@/components/toast"

interface EpisodeApiResponse {
  episode: {
    id: string
    title: string
    published_at: string | null
    duration_secs: number | null
  }
  speakers: Array<{ id: string; name: string }>
  segments: Array<{
    start_ms: number
    speaker_name: string
    text: string
  }>
}

async function fetchEpisodeExport(id: string): Promise<{
  markdown: string
  filename: string
}> {
  const res = await fetch(`/api/episodes/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch episode ${id}`)
  const data: EpisodeApiResponse = await res.json()

  const markdown = generateExportMarkdown(
    {
      title: data.episode.title,
      publishedAt: data.episode.published_at,
      durationSecs: data.episode.duration_secs,
      speakers: data.speakers.map((s) => s.name),
    },
    data.segments.map((seg) => ({
      startMs: seg.start_ms,
      speakerName: seg.speaker_name,
      text: seg.text,
    })),
  )

  return { markdown, filename: episodeFilename(data.episode.title) }
}

interface DashboardProps {
  initialEpisodes: EpisodeRow[]
}

export function Dashboard({ initialEpisodes }: DashboardProps) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initialEpisodes)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const pollRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  )

  const completedEpisodes = episodes.filter((ep) => ep.status === "completed")
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
      const results = await Promise.all(
        Array.from(selectedIds).map(fetchEpisodeExport),
      )
      const zip = new JSZip()
      const usedNames = new Set<string>()
      for (const r of results) {
        let name = r.filename
        let counter = 1
        while (usedNames.has(name)) {
          name = r.filename.replace(/\.md$/, `-${++counter}.md`)
        }
        usedNames.add(name)
        zip.file(name, r.markdown)
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "transcripts.zip"
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Downloading ${results.length} transcript${results.length > 1 ? "s" : ""}`)
    } catch {
      showToast("Failed to download transcripts")
    } finally {
      setExporting(false)
    }
  }, [selectedIds])

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
    setEpisodes((prev) => prev.filter((ep) => ep.id !== id))
    try {
      const res = await fetch(`/api/episodes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        showToast("Delete failed")
      }
    } catch {
      showToast("Delete failed")
    }
  }, [])

  useEffect(() => {
    for (const ep of episodes) {
      if (ep.status !== "completed" && ep.status !== "failed") {
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
    (episodeId: string, title: string) => {
      const newEp: EpisodeRow = {
        id: episodeId,
        title,
        createdAt: new Date().toISOString(),
        status: "queued",
      }
      setEpisodes((prev) => [newEp, ...prev])
      startPolling(episodeId)
    },
    [startPolling],
  )

  return (
    <div className="flex flex-col gap-10">
      <SubmitForm onSubmitted={handleSubmitted} />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recent episodes
          </h2>
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

        <EpisodeListView
          episodes={episodes}
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
