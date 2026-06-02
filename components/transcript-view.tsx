"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { formatTimestamp } from "@/lib/format"
import {
  generateExportMarkdown,
  episodeFilename,
  type ExportSegment,
} from "@/lib/export"
import type { EpisodeEnrichment } from "@/lib/db/schema"
import { notifySuccess } from "@/lib/notify"

const SPEAKER_COLORS = [
  "text-sky-400",
  "text-emerald-400",
  "text-violet-400",
  "text-amber-400",
  "text-rose-400",
  "text-cyan-400",
  "text-fuchsia-400",
  "text-lime-400",
]

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

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
    notifySuccess("Transcript copied to clipboard")
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
    notifySuccess("Downloading transcript")
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
          className={`rounded-[8px] bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-fg transition-colors duration-150 ease-out hover:bg-accent-hover ${focusRing}`}
        >
          Copy transcript
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className={`rounded-[8px] border border-border px-3.5 py-1.5 text-sm font-medium text-fg-secondary transition-colors duration-150 ease-out hover:border-border-strong hover:bg-elevated hover:text-fg ${focusRing}`}
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
                    className={`w-32 rounded-[8px] border border-border bg-surface px-1.5 py-0.5 text-sm text-fg ${focusRing}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    disabled={savingIds.has(s.id)}
                    className={`group flex items-center gap-1 text-fg-secondary transition-colors duration-150 ease-out hover:text-fg ${focusRing}`}
                  >
                    <span>{s.name}</span>
                    {savingIds.has(s.id) ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-border border-t-accent" />
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
            className={`self-start rounded-[8px] px-2.5 py-1 text-xs font-medium text-fg-secondary transition-colors duration-150 ease-out hover:bg-elevated hover:text-fg disabled:opacity-50 ${focusRing}`}
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
        <p className="text-xs text-status-fail">{error}</p>
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
                <span className="font-mono text-xs text-fg-muted">
                  [{formatTimestamp(seg.startMs)}]
                </span>
                <span className={`text-sm font-semibold ${colorClass}`}>
                  {speaker?.name ?? "Unknown"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-fg-secondary">
                {seg.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
