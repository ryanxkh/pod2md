"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { formatTimestamp } from "@/lib/format"
import {
  generateExportMarkdown,
  episodeFilename,
  type ExportSegment,
} from "@/lib/export"
import type { EpisodeEnrichment } from "@/lib/db/schema"
import { showToast } from "@/components/toast"

const SPEAKER_COLORS = [
  "text-blue-600 dark:text-blue-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-violet-600 dark:text-violet-400",
  "text-amber-600 dark:text-amber-400",
  "text-rose-600 dark:text-rose-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-lime-600 dark:text-lime-400",
]

const DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
]

const SPEAKER_LABEL_RE = /^SPEAKER_\d+$/

interface Speaker {
  id: string
  label: string
  name: string
}

interface Segment {
  id: string
  startMs: number
  endMs: number
  speakerId: string
  text: string
}

interface TranscriptViewProps {
  episodeId: string
  episodeTitle: string
  sourceUrl?: string | null
  publishedAt: string | null
  createdAt?: string | null
  durationSecs: number | null
  collection?: string | null
  transcribedAt?: string | null
  show?: string | null
  language?: string | null
  enrichment?: EpisodeEnrichment | null
  speakers: Speaker[]
  segments: Segment[]
}

export function TranscriptView({
  episodeId,
  episodeTitle,
  sourceUrl,
  publishedAt,
  durationSecs,
  collection,
  transcribedAt,
  createdAt,
  show,
  language,
  enrichment,
  speakers: initialSpeakers,
  segments,
}: TranscriptViewProps) {
  const [speakers, setSpeakers] = useState(initialSpeakers)
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const speakerIndex = new Map(speakers.map((s, i) => [s.id, i]))

  const allNamed = speakers.every((s) => !SPEAKER_LABEL_RE.test(s.name))

  const buildExportMarkdown = useCallback(() => {
    const exportSegments: ExportSegment[] = segments.map((seg) => {
      const speaker = speakers.find((s) => s.id === seg.speakerId)
      return {
        startMs: seg.startMs,
        speakerName: speaker?.name ?? "Unknown",
        text: seg.text,
      }
    })
    return generateExportMarkdown(
      {
        id: episodeId,
        title: episodeTitle,
        sourceUrl: sourceUrl ?? null,
        publishedAt,
        createdAt: createdAt ?? transcribedAt ?? null,
        durationSecs,
        speakers: speakers.map((s) => s.name),
        collection: collection ?? null,
        transcribedAt: transcribedAt ?? null,
        show: show ?? null,
        language: language ?? null,
        enrichment: enrichment ?? null,
      },
      exportSegments,
    )
  }, [
    segments,
    speakers,
    episodeId,
    episodeTitle,
    sourceUrl,
    publishedAt,
    createdAt,
    durationSecs,
    collection,
    transcribedAt,
    show,
    language,
    enrichment,
  ])

  const handleCopy = useCallback(async () => {
    const md = buildExportMarkdown()
    await navigator.clipboard.writeText(md)
    showToast("Transcript copied to clipboard")
  }, [buildExportMarkdown])

  const handleDownload = useCallback(() => {
    const md = buildExportMarkdown()
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = episodeFilename({
      id: episodeId,
      title: episodeTitle,
      publishedAt,
      createdAt: createdAt ?? transcribedAt ?? null,
    })
    a.click()
    URL.revokeObjectURL(url)
    showToast("Downloading transcript")
  }, [buildExportMarkdown, episodeId, episodeTitle, publishedAt, createdAt, transcribedAt])

  useEffect(() => {
    if (editingSpeakerId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSpeakerId])

  const startEdit = useCallback((speaker: Speaker) => {
    setEditingSpeakerId(speaker.id)
    setEditValue(speaker.name)
    setError(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingSpeakerId(null)
    setEditValue("")
  }, [])

  const saveEdit = useCallback(
    async (speakerId: string) => {
      const trimmed = editValue.trim()
      const prev = speakers.find((s) => s.id === speakerId)
      if (!trimmed || !prev || trimmed === prev.name) {
        cancelEdit()
        return
      }

      setSpeakers((cur) =>
        cur.map((s) => (s.id === speakerId ? { ...s, name: trimmed } : s)),
      )
      setEditingSpeakerId(null)
      setSavingIds((cur) => new Set(cur).add(speakerId))
      setError(null)

      try {
        const res = await fetch(`/api/episodes/${episodeId}/speakers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speaker_id: speakerId, name: trimmed }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? "Failed to save")
        }
      } catch (err) {
        setSpeakers((cur) =>
          cur.map((s) => (s.id === speakerId ? { ...s, name: prev.name } : s)),
        )
        setError(
          err instanceof Error ? err.message : "Failed to rename speaker",
        )
      } finally {
        setSavingIds((cur) => {
          const next = new Set(cur)
          next.delete(speakerId)
          return next
        })
      }
    },
    [editValue, speakers, episodeId, cancelEdit],
  )

  const resolveNames = useCallback(async () => {
    setResolving(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/speakers/resolve`,
        { method: "POST" },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Resolution failed")
      }
      const { speakers: resolved } = (await res.json()) as {
        speakers: Speaker[]
      }
      setSpeakers(resolved)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve speaker names",
      )
    } finally {
      setResolving(false)
    }
  }, [episodeId])

  return (
    <div className="flex flex-col gap-8">
      {/* Export actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Copy transcript
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Download .md
        </button>
      </div>

      {/* Speaker legend */}
      {speakers.length > 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            {speakers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`}
                />
                {editingSpeakerId === s.id ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(s.id)
                      if (e.key === "Escape") cancelEdit()
                    }}
                    onBlur={() => saveEdit(s.id)}
                    className="w-32 rounded border border-zinc-300 bg-transparent px-1.5 py-0.5 text-sm text-zinc-600 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:text-zinc-400 dark:focus:border-zinc-400"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    disabled={savingIds.has(s.id)}
                    className="group flex items-center gap-1 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    <span>{s.name}</span>
                    {savingIds.has(s.id) ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                    ) : (
                      <svg
                        className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={resolveNames}
            disabled={resolving}
            className="self-start rounded px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            {resolving
              ? "Resolving\u2026"
              : allNamed
                ? "Re-resolve speaker names"
                : "Resolve speaker names"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Transcript segments */}
      <div className="flex flex-col gap-6">
        {segments.map((seg) => {
          const idx = speakerIndex.get(seg.speakerId) ?? 0
          const speaker = speakers.find((s) => s.id === seg.speakerId)
          const colorClass = SPEAKER_COLORS[idx % SPEAKER_COLORS.length]

          return (
            <div key={seg.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  [{formatTimestamp(seg.startMs)}]
                </span>
                <span className={`text-sm font-semibold ${colorClass}`}>
                  {speaker?.name ?? "Unknown"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {seg.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
